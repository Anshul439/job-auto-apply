import { Page } from 'playwright';
import { SELECTORS, JOB_URL_RE } from './selectors.js';
import * as log from './logger.js';

const WELLFOUND_BASE = 'https://wellfound.com';

// ─── Job listing collection ──────────────────────────────────────────────────

/**
 * Scrolls through the current Wellfound filtered-results page, clicking
 * "Load more" if available, and returns the deduplicated list of absolute
 * job-detail URLs found on the page.
 *
 * This function mutates the page scroll position but does NOT navigate away.
 */
export async function getJobListings(page: Page): Promise<string[]> {
  const seen = new Set<string>();
  let stableRounds = 0;
  const MAX_STABLE_ROUNDS = 4;

  log.step('Collecting job listings…');

  while (stableRounds < MAX_STABLE_ROUNDS) {
    const countBefore = seen.size;

    // ── Harvest currently visible job links ──────────────────────────────
    // We query both generic /jobs/ links AND the "Learn more" anchor buttons
    // that Wellfound uses on its current listing-card UI. Both resolve to the
    // same job detail URLs so deduplication handles overlaps.
    const combinedSelector = `${SELECTORS.jobDetailLink}, ${SELECTORS.learnMoreLink}`;
    const hrefs: string[] = await page.$$eval(
      combinedSelector,
      (anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).href)
          .filter(Boolean),
    );

    for (const href of hrefs) {
      if (JOB_URL_RE.test(href)) {
        // Normalise to an absolute URL without trailing fragments/queries.
        try {
          const url = new URL(href);
          url.search   = '';
          url.hash     = '';
          seen.add(url.toString());
        } catch {
          // Skip malformed URLs.
        }
      }
    }

    // ── Try "Load more" button ───────────────────────────────────────────
    const loadMore = page.locator(SELECTORS.loadMoreButton).first();
    const loadMoreVisible = await loadMore.isVisible().catch(() => false);

    if (loadMoreVisible) {
      log.info(`Load more button found — clicking (${seen.size} jobs so far)…`);
      await loadMore.click();
      // Wait for new cards to appear.
      await page.waitForTimeout(2500);
    } else {
      // No button — scroll to the bottom to trigger infinite-scroll.
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
      );
      await page.waitForTimeout(2000);
    }

    // ── Stability check ──────────────────────────────────────────────────
    if (seen.size === countBefore) {
      stableRounds++;
    } else {
      stableRounds = 0;
    }
  }

  log.info(`Found ${seen.size} unique job listing(s).`);
  return [...seen];
}

// ─── Per-job helpers ─────────────────────────────────────────────────────────

/**
 * Navigates to the given job URL and waits for the page to settle.
 * Returns the resolved URL after navigation (may differ due to redirects).
 */
export async function openJob(page: Page, jobUrl: string): Promise<string> {
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Give any React hydration a moment to settle.
  await page.waitForTimeout(1000);
  return page.url();
}

/**
 * Returns `true` if the current page shows that the user has already
 * applied to this position (e.g. the Apply button reads "Applied").
 *
 * Scoped to the main content area so we never false-positive on the
 * Wellfound left-nav "Applied" link that appears on every page.
 */
export async function isAlreadyApplied(page: Page): Promise<boolean> {
  // Prefer the main content container; fall back to the full page if absent.
  const main = page.locator('main, [role="main"]').first();
  const hasMain = await main.count().then((n) => n > 0).catch(() => false);
  const scope = hasMain ? main : page.locator('body');

  const indicator = scope.locator(SELECTORS.alreadyApplied).first();
  return indicator.isVisible().catch(() => false);
}

/**
 * Returns the visible Apply / Easy Apply button on the current page,
 * or `null` if none can be found.
 *
 * We look for the button, exclude any that are visually disabled or that
 * already read "Applied".
 */
export async function findApplyButton(page: Page) {
  const candidates = page.locator(SELECTORS.applyButton);
  const count = await candidates.count();

  for (let i = 0; i < count; i++) {
    const btn = candidates.nth(i);

    const visible  = await btn.isVisible().catch(() => false);
    if (!visible) continue;

    const disabled = await btn.isDisabled().catch(() => false);
    if (disabled) continue;

    const text = (await btn.innerText().catch(() => '')).trim().toLowerCase();
    // Skip any button whose text is "applied" (already-applied state).
    if (text === 'applied') continue;

    return btn;
  }

  return null;
}

/**
 * Extracts the company name and role title from the current job detail page
 * for display purposes. Falls back gracefully if the page structure differs.
 */
export async function getJobMeta(
  page: Page,
): Promise<{ company: string; role: string }> {
  try {
    const title = await page.title();
    // Wellfound titles are typically "Role at Company | Wellfound"
    const match = title.match(/^(.+?)\s+at\s+(.+?)\s*[|\-]/);
    if (match) {
      return { role: match[1].trim(), company: match[2].trim() };
    }
    return { company: 'Unknown Company', role: title.split('|')[0].trim() };
  } catch {
    return { company: 'Unknown Company', role: 'Unknown Role' };
  }
}

/**
 * Returns the current page URL to be used as a unique job identifier.
 */
export function getJobId(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

/**
 * Resolves a possibly-relative Wellfound path to an absolute URL.
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith('http')) return href;
  return `${WELLFOUND_BASE}${href}`;
}
