import { Page, Locator } from 'playwright';
import { IH } from './selectors.js';
import * as log from '../logger.js';

// ─── Card collection ──────────────────────────────────────────────────────────

/**
 * Returns the count of "View »" buttons on the current page.
 */
export async function getCardCount(page: Page): Promise<number> {
  return page.locator(IH.viewButton).count();
}

/**
 * Clicks "Next »" if available. Returns true if navigation happened.
 */
export async function goToNextPage(page: Page, currentPage: number): Promise<boolean> {
  // Dismiss the "Go Premium" popup if it appeared (blocks pagination).
  const dismissBtn = page.locator('a:has-text("No thanks"), button:has-text("No thanks")').first();
  if (await dismissBtn.isVisible().catch(() => false)) {
    await dismissBtn.click();
    log.info('Dismissed "Go Premium" popup');
    await page.waitForTimeout(800);
  }

  // Scroll to the bottom — pagination is in the footer.
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
  await page.waitForTimeout(1500);

  // Strategy 1: Playwright selector for "Next »".
  const next = page.locator(IH.nextPageButton).first();
  const visible = await next.isVisible().catch(() => false);
  if (visible) {
    const className = await next.getAttribute('class').catch(() => '') ?? '';
    if (!className.includes('disabled')) {
      await next.click();
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await page.waitForTimeout(500);
      return true;
    }
  }

  // Strategy 2: Click the next page NUMBER via JS (searches ALL elements,
  // not just <a> — Instahyre pagination uses ng-click on <span>/<li>).
  const nextNum = currentPage + 1;
  const clickedNumber = await page.evaluate((num) => {
    const els = Array.from(document.querySelectorAll('a, span, li, button, div'));
    const target = els.find((el) => el.textContent?.trim() === String(num));
    if (target) { (target as HTMLElement).click(); return `Found element with text "${num}"`; }
    return null;
  }, nextNum);

  if (clickedNumber) {
    log.info(`Strategy 2: ${clickedNumber}`);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(500);
    return true;
  }

  // Strategy 3: Find "Next »" element via JS across all element types.
  const clickedNext = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, span, li, button, div'));
    const target = els.find((el) => {
      const text = el.textContent?.trim() ?? '';
      return text === 'Next »' || text === 'Next»' || text === '»' || text === '›';
    });
    if (target) { (target as HTMLElement).click(); return `Found: "${target.textContent?.trim()}"`; }
    return null;
  });

  if (clickedNext) {
    log.info(`Strategy 3: ${clickedNext}`);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await page.waitForTimeout(500);
    return true;
  }

  log.info('No pagination found — last page reached.');
  return false;
}

// ─── Modal operations ─────────────────────────────────────────────────────────

/**
 * Clicks the nth "View »" button and waits for the AngularJS modal to open.
 */
export async function openJobModal(page: Page, index: number): Promise<boolean> {
  const btn = page.locator(IH.viewButton).nth(index);
  if (!(await btn.isVisible().catch(() => false))) return false;

  await btn.click();

  const backdrop = page.locator(IH.modalBackdrop).first();
  const appeared = await backdrop
    .waitFor({ state: 'visible', timeout: 6000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) return false;

  // If Instahyre shows a rate-limit / error banner, wait and retry once.
  const errorBanner = page.locator(':has-text("Something went wrong"), :has-text("try again after")').first();
  if (await errorBanner.isVisible().catch(() => false)) {
    log.info('Rate limit detected — waiting 90 seconds before retrying…');
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(90_000);
    // Retry the click once after the pause.
    await btn.click();
    await backdrop.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  }

  // Wait for Apply / Not interested to appear (content loaded).
  const container = page.locator(IH.modalContainer).first();
  const contentLoaded = await container
    .locator(`${IH.applyButton}, ${IH.alreadyApplied}, ${IH.notInterestedButton}`)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  return contentLoaded;
}

export async function isModalOpen(page: Page): Promise<boolean> {
  return page.locator(IH.modalBackdrop).first().isVisible().catch(() => false);
}

export async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(600);

  if (await isModalOpen(page)) {
    const backdrop = page.locator(IH.modalBackdrop).first();
    await backdrop.click({ position: { x: 10, y: 10 }, force: true }).catch(() => undefined);
    await page.waitForTimeout(600);
  }

  if (await isModalOpen(page)) {
    await page.evaluate(() => {
      const backdrop = document.querySelector('.application-modal-backdrop') as HTMLElement;
      backdrop?.click();
    }).catch(() => undefined);
    await page.waitForTimeout(500);
  }
}

// ─── Job identification ───────────────────────────────────────────────────────

/**
 * Reads a unique identifier from the LISTING CARD text (before opening the
 * modal). Each card on the listing page shows "Company - Role" plus location
 * which is always pre-loaded — no async wait needed.
 *
 * This is used for dedup instead of modal headings which load too late.
 */
export async function getCardIdentifier(page: Page, index: number): Promise<string> {
  const viewBtn = page.locator(IH.viewButton).nth(index);
  return viewBtn.evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    for (let i = 0; i < 6; i++) {
      if (!node?.parentElement) break;
      node = node.parentElement;
    }
    const lines = (node?.innerText ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('View') && !l.startsWith('Not interested'));
    // First two lines are typically "Company - Role" and location/meta.
    return lines.slice(0, 3).join(' | ');
  });
}

/**
 * Reads company + role from the open modal for logging.
 */
export async function getJobMetaFromModal(
  page: Page,
): Promise<{ company: string; role: string }> {
  try {
    const container = page.locator(IH.modalContainer).first();
    const role = (await container.locator('h1').first().innerText().catch(() => '')).trim();

    // Company might be h2, or some other element near the top.
    let company = '';
    const candidates = ['h2', 'h3', '.ng-binding', 'p', 'span', 'a'];
    for (const sel of candidates) {
      const text = (await container.locator(sel).first().innerText().catch(() => '')).trim();
      if (text && text !== role && text.length < 80 && !text.toLowerCase().includes('loading')) {
        company = text;
        break;
      }
    }

    return {
      role:    role    || 'Unknown Role',
      company: company || 'Unknown Company',
    };
  } catch {
    return { role: 'Unknown Role', company: 'Unknown Company' };
  }
}

// ─── Apply-flow checks ───────────────────────────────────────────────────────

export async function isAlreadyApplied(page: Page): Promise<boolean> {
  const container = page.locator(IH.modalContainer).first();
  return container.locator(IH.alreadyApplied).first().isVisible().catch(() => false);
}

export async function findApplyButton(page: Page): Promise<Locator | null> {
  const container = page.locator(IH.modalContainer).first();
  const btn = container.locator(IH.applyButton).first();
  if (!(await btn.isVisible().catch(() => false))) return null;
  if (await btn.isDisabled().catch(() => false)) return null;
  return btn;
}

export async function hasCaptcha(page: Page): Promise<boolean> {
  const container = page.locator(IH.modalContainer).first();
  return container.locator(IH.captcha).first().isVisible().catch(() => false);
}

/**
 * Clicks Apply and waits for the "Application sent to…" toast.
 */
export async function applyAndConfirm(page: Page, applyBtn: Locator): Promise<boolean> {
  await applyBtn.click();

  const toast = page.locator(IH.successToast).first();
  return toast
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
}
