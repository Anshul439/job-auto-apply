/**
 * Centralized Wellfound DOM selectors.
 *
 * Update these if Wellfound changes its UI. Prefer text, ARIA roles, and
 * stable attributes over fragile CSS class names.
 */
export const SELECTORS = {
  // ──────────────────────────────────────────────────────────────────────────
  // Listing / search-results page
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Links to individual job detail pages.
   * Wellfound job URLs can look like:
   *   /jobs/<id>-role-slug
   *   /companies/<slug>/jobs/<id>-role-slug
   * The "Learn more" button and job title on listing cards both use these hrefs.
   * We filter to numeric-ID URLs in JS (see JOB_URL_RE).
   */
  jobDetailLink: 'a[href*="/jobs/"]',

  /**
   * The "Learn more" button on job listing cards (Wellfound 2025+ UI).
   * These also contain href attributes pointing to job detail pages.
   */
  learnMoreLink: 'a:has-text("Learn more")',

  /**
   * "Load more" / "Show more" buttons that appear at the bottom of the
   * results list when there are more jobs to load.
   */
  loadMoreButton: [
    'button:has-text("Load more jobs")',
    'button:has-text("Load more")',
    'button:has-text("Show more jobs")',
    'button:has-text("Show more")',
    'button:has-text("View more")',
  ].join(', '),

  // ──────────────────────────────────────────────────────────────────────────
  // Job detail page
  // ──────────────────────────────────────────────────────────────────────────

  /** The primary "Apply" or "Easy Apply" action button. */
  applyButton: [
    'button:has-text("Apply")',
    'button:has-text("Easy Apply")',
    'a:has-text("Apply")',
    'a:has-text("Easy Apply")',
  ].join(', '),

  /**
   * Indicators that the current user has already applied to this job.
   *
   * IMPORTANT: Wellfound's left-nav has a link labelled "Applied" that appears
   * on every page. Selectors here must NOT match nav/sidebar elements.
   * We rely on isAlreadyApplied() scoping these to the main content area.
   *
   * We only match buttons (not spans/links) so we don't hit the nav.
   * A disabled Apply button, or a button whose label changed to "Applied",
   * are the two real signals.
   */
  alreadyApplied: [
    'button:has-text("Applied")',
    'button[disabled]:has-text("Apply")',
    'button[aria-disabled="true"]:has-text("Apply")',
    '[data-test="applied-badge"]',
    '[data-testid="applied-badge"]',
  ].join(', '),

  // ──────────────────────────────────────────────────────────────────────────
  // Application modal / dialog
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * The application modal / overlay container.
   * Wellfound uses react-modal, which renders content inside
   * .ReactModalPortal > .ReactModal__Overlay > .ReactModal__Content.
   * We also keep standard ARIA selectors as fallbacks.
   */
  applicationModal: [
    '.ReactModal__Overlay--after-open',
    '.ReactModal__Content',
    '[role="dialog"]',
    '[aria-modal="true"]',
  ].join(', '),

  /**
   * Text / element patterns inside the modal that indicate this is an
   * external (non-Wellfound) application.
   */
  externalModalIndicator: [
    'button:has-text("Apply on company website")',
    'button:has-text("Continue to company site")',
    'button:has-text("Continue to")',
    'a:has-text("Apply on")',
    '[data-test="external-apply"]',
    '[data-testid="external-apply"]',
  ].join(', '),

  /**
   * The cover-letter / "What interests you…" / free-text note textarea.
   * This field is optional on Wellfound; we leave it blank.
   * Listed from most-specific to least-specific.
   */
  coverLetterTextarea: [
    'textarea[name*="cover"]',
    'textarea[name*="note"]',
    'textarea[name*="motivation"]',
    'textarea[name*="interest"]',
    'textarea[placeholder*="cover letter"]',
    'textarea[placeholder*="interest"]',
    'textarea[placeholder*="note"]',
    'textarea[aria-label*="cover"]',
    'textarea[aria-label*="note"]',
    'textarea[aria-label*="interest"]',
  ].join(', '),

  /**
   * Required fields inside the application modal that are NOT the resume
   * file input. If any such field is empty, we skip rather than fill it.
   */
  requiredEmptyField: [
    'input[required]:not([type="file"]):not([type="hidden"])',
    'textarea[required]',
    'select[required]',
  ].join(', '),

  /**
   * CAPTCHA indicators. If any of these are found, we stop and skip.
   */
  captcha: [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[title*="reCAPTCHA"]',
    'iframe[title*="hCaptcha"]',
    '.g-recaptcha',
    '[data-sitekey]',
    'iframe[src*="challenges.cloudflare.com"]',
  ].join(', '),

  /**
   * The final submit / "Send Application" button inside the modal.
   * Wellfound uses various labels; list from most-specific to least-specific.
   */
  submitButton: [
    'button:has-text("Send Application")',
    'button:has-text("Submit Application")',
    'button:has-text("Confirm Application")',
    'button:has-text("Apply Now")',
    'button:has-text("Submit")',
  ].join(', '),

  /**
   * Success indicators after an application is submitted.
   * Wellfound may show an inline confirmation or change the Apply button.
   */
  successIndicator: [
    'button:has-text("Applied")',
    'div:has-text("Application sent")',
    'div:has-text("application was sent")',
    'div:has-text("successfully applied")',
    'p:has-text("Application sent")',
    '[data-test="application-success"]',
    '[data-testid="application-success"]',
  ].join(', '),

  /** Close / dismiss button inside the modal or overlay. */
  modalCloseButton: [
    'button[aria-label="Close"]',
    'button[aria-label="Dismiss"]',
    'button[aria-label="close"]',
    'button:has-text("Close")',
    'button:has-text("Cancel")',
    'button:has-text("×")',
    'button:has-text("✕")',
  ].join(', '),
} as const;

/**
 * Matches individual Wellfound job detail URLs in either format:
 *   /jobs/<numeric-id>-slug
 *   /companies/<slug>/jobs/<numeric-id>-slug
 *
 * Does NOT match search/filter pages like /jobs?role=... or /jobs/categories/...
 */
export const JOB_URL_RE = /\/jobs\/\d+/;

/** Regex that matches the Wellfound domain. */
export const WELLFOUND_DOMAIN_RE = /wellfound\.com/;
