import path from 'path';
import { Page, Locator, BrowserContext } from 'playwright';
import { SELECTORS, WELLFOUND_DOMAIN_RE } from './selectors.js';
import * as log from '../logger.js';

const SCREENSHOTS_DIR = path.resolve('screenshots');

// ─── Result types ────────────────────────────────────────────────────────────

export type ApplicationResult =
  | 'applied'
  | 'already_applied'
  | 'skipped_external'
  | 'skipped_mandatory_fields'
  | 'skipped_captcha'
  | 'skipped_no_apply_button'
  | 'skipped_error';

// ─── Modal helpers ────────────────────────────────────────────────────────────

/**
 * Clicks the Apply button and detects what Wellfound does next.
 *
 * Returns a Locator scoped to the application form/container, or `null` if
 * the flow is external or unrecognisable.
 *
 * Detection cascade (in order):
 *  1. New browser tab → external (non-wellfound URL) → skip
 *  2. Current tab navigated to a Wellfound apply URL → use main content
 *  3. A dialog/overlay element appeared → use that
 *  4. The submit button appeared anywhere on the page → use main content
 *  5. Nothing → screenshot + skip
 */
export async function openApplication(
  page: Page,
  context: BrowserContext,
  applyButton: Locator,
): Promise<Locator | null> {
  const urlBefore = page.url();

  // Register BEFORE clicking — a new tab may open immediately.
  let newTabPage: Page | null = null;
  const tabHandler = (p: Page) => { newTabPage = p; };
  context.on('page', tabHandler);

  await applyButton.click();

  // Allow time for: modal animation, page navigation, or tab to open.
  await page.waitForTimeout(2500);
  context.off('page', tabHandler);

  // ── 1. New tab opened? ─────────────────────────────────────────────────────
  if (newTabPage) {
    const tabUrl = (newTabPage as Page).url();
    await (newTabPage as Page).close().catch(() => {});

    if (!WELLFOUND_DOMAIN_RE.test(tabUrl)) {
      return null; // Genuine external ATS in a new tab → skip
    }
    // Wellfound opened its own tab (rare edge case).
    // The application form might still be on the original page, so fall through.
  }

  // ── 2. Current tab navigated to a Wellfound apply URL? ────────────────────
  const urlAfter = page.url();
  if (urlAfter !== urlBefore) {
    if (!WELLFOUND_DOMAIN_RE.test(urlAfter)) return null; // External redirect
    return mainArea(page);
  }

  // ── 3. ReactModal overlay appeared? (Wellfound's react-modal) ─────────────
  // The overlay lives inside ReactModalPortal and covers the entire viewport.
  // Buttons INSIDE it are clickable (they're descendants, not behind it).
  const overlay = page.locator('.ReactModal__Overlay--after-open').first();
  if (await overlay.isVisible().catch(() => false)) {
    log.info('Detected ReactModal overlay');
    return overlay;
  }

  // ── 4. Standard dialog / aria-modal? ──────────────────────────────────────
  const dialog = page.locator('[role="dialog"], [aria-modal="true"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    log.info('Detected ARIA dialog');
    return dialog;
  }

  // ── 5. Submit button inside ReactModalPortal? ─────────────────────────────
  // The portal might use custom class names we didn't anticipate.
  const portalSubmit = page
    .locator('.ReactModalPortal')
    .locator(SELECTORS.submitButton)
    .first();
  const portalSubmitVisible = await portalSubmit
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false);

  if (portalSubmitVisible) {
    log.info('Detected submit button inside ReactModalPortal');
    return page.locator('.ReactModalPortal').first();
  }

  // ── 6. Nothing detected ────────────────────────────────────────────────────
  const screenshotPath = await takeDebugScreenshot(page, 'apply_no_form_detected');
  log.info(`No application form detected. Screenshot saved: ${screenshotPath}`);
  return null;
}

/** Returns the main content area of the page, falling back to body. */
async function mainArea(page: Page): Promise<Locator> {
  const main = page.locator('main, [role="main"]').first();
  const exists = await main.count().then((n) => n > 0).catch(() => false);
  return exists ? main : page.locator('body');
}

/**
 * Checks whether the form container is routing to an external application.
 *
 * We deliberately check ONLY explicit "apply externally" button text.
 * We do NOT scan all links because when the container is 'main' or 'body',
 * innocent social / company links would cause false positives.
 */
export async function isExternalApplication(modal: Locator): Promise<boolean> {
  const externalBtn = modal.locator(SELECTORS.externalModalIndicator).first();
  return externalBtn.isVisible().catch(() => false);
}

/**
 * Returns `true` if the modal contains a CAPTCHA challenge.
 */
export async function hasCaptcha(modal: Locator): Promise<boolean> {
  return modal
    .locator(SELECTORS.captcha)
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Inspects the application modal for mandatory unfilled fields (excluding the
 * resume file input and hidden fields, which are handled automatically).
 *
 * Also respects Wellfound's convention of marking required fields with aria-required.
 *
 * Returns `true` if at least one mandatory field has no value and would block
 * submission without human-written content.
 */
export async function hasMandatoryAdditionalFields(modal: Locator): Promise<boolean> {
  return modal.evaluate((el) => {
    const SKIP_TYPES = new Set(['file', 'hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio']);

    const fields = Array.from(
      el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select',
      ),
    );

    for (const field of fields) {
      if (field instanceof HTMLInputElement && SKIP_TYPES.has(field.type)) continue;

      const isRequired =
        field.required ||
        field.getAttribute('aria-required') === 'true';

      if (!isRequired) continue;

      const value =
        field instanceof HTMLSelectElement
          ? field.value
          : field.value?.trim() ?? '';

      if (!value) return true;
    }

    return false;
  });
}

/**
 * Clicks the submit button inside the modal and waits for confirmation.
 *
 * Returns `true` on success, `false` if validation errors appear or the
 * modal fails to close / confirm within the timeout.
 */
export async function submitApplication(
  page: Page,
  modal: Locator,
): Promise<boolean> {
  // Find the submit button INSIDE the modal container only.
  // Never search the whole page — that finds the background "Apply now" button
  // which is blocked by the ReactModal overlay.
  const scopes = [
    modal,
    page.locator('.ReactModalPortal'),
  ];

  let submitBtn: Locator | null = null;
  for (const scope of scopes) {
    const candidate = scope.locator(SELECTORS.submitButton).first();
    if (await candidate.isVisible().catch(() => false)) {
      submitBtn = candidate;
      break;
    }
  }

  if (!submitBtn) {
    log.info('No submit button found inside modal — trying data-test="Button" inside portal');
    // Last resort: Wellfound buttons use data-test="Button".
    // Look for any button with "apply" text inside the portal.
    const fallback = page
      .locator('.ReactModalPortal button[data-test="Button"]')
      .filter({ hasText: /apply/i })
      .first();
    if (await fallback.isVisible().catch(() => false)) {
      submitBtn = fallback;
    }
  }

  if (!submitBtn) return false;

  const urlBefore = page.url();
  await submitBtn.click();

  // Wait for any of: success message, modal detaches, URL changes (navigates away).
  const success = await Promise.race([
    // Explicit confirmation message / Applied button appears
    page
      .locator(SELECTORS.successIndicator)
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false),

    // Dialog / overlay closes (detaches from DOM)
    modal
      .waitFor({ state: 'detached', timeout: 10_000 })
      .then(() => true)
      .catch(() => false),

    // Page navigated back (apply page → job detail page)
    (async (): Promise<boolean> => {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(500);
        if (page.url() !== urlBefore) return true;
      }
      return false;
    })(),
  ]);

  return success;
}

/**
 * After the modal closes, verifies that the job now shows as "Applied"
 * on the detail page.
 */
export async function verifyApplication(page: Page): Promise<boolean> {
  // Allow a short moment for the page to update.
  await page.waitForTimeout(1500);

  const applied = page.locator(SELECTORS.alreadyApplied).first();
  return applied.isVisible().catch(() => false);
}

// ─── Screenshot helper ────────────────────────────────────────────────────────

/**
 * Takes a debug screenshot and saves it in the ./screenshots directory.
 * Returns the file path.
 */
export async function takeDebugScreenshot(
  page: Page,
  label: string,
): Promise<string> {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = label.replace(/[^a-z0-9-_]/gi, '_').slice(0, 60);
  const file = path.join(SCREENSHOTS_DIR, `${ts}_${safe}.png`);

  await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
  return file;
}

// ─── Dismiss modal ────────────────────────────────────────────────────────────

/**
 * Attempts to dismiss / close the application modal without submitting.
 * Tries the close button, then falls back to pressing Escape.
 */
export async function dismissModal(page: Page, modal: Locator): Promise<void> {
  // react-modal responds to Escape by default — this is the most reliable way.
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(600);

  // If the modal is still visible, try clicking a close button.
  const stillVisible = await modal.isVisible().catch(() => false);
  if (stillVisible) {
    try {
      for (const scope of [modal, page.locator('.ReactModalPortal')]) {
        const closeBtn = scope.locator(SELECTORS.modalCloseButton).first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
          await page.waitForTimeout(400);
          return;
        }
      }
    } catch { /* ignore */ }
  }
}
