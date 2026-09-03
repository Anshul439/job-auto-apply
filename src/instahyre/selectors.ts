/**
 * Instahyre DOM selectors — based on actual AngularJS UI.
 *
 * Instahyre uses AngularJS (not React). The job detail modal is controlled
 * by ng-controller="employerProfileModalCtrl" and has a backdrop with
 * class "application-modal-backdrop".
 */
export const IH = {
  // ── Opportunities listing page ────────────────────────────────────────────

  /**
   * The green "View »" button on each job card. Must be specific to avoid
   * matching the card's company link which also contains "View" text.
   */
  viewButton: 'button:has-text("View »")',

  /**
   * "Next »" pagination element at the bottom.
   * Instahyre uses AngularJS ng-click, so pagination may be <span>, <li>, etc.
   * Do NOT match broadly on "Next" — "Next.js" skill tags would collide.
   */
  nextPageButton: ':has-text("Next »")',

  // ── Job detail modal (AngularJS) ──────────────────────────────────────────

  /** The backdrop that covers the page when a job modal is open. */
  modalBackdrop: '.application-modal-backdrop',

  /** The AngularJS controller scope that wraps all modal content. */
  modalContainer: '[ng-controller="employerProfileModalCtrl"]',

  /** The blue "Apply" button at the bottom of the modal. */
  applyButton: 'button:has-text("Apply")',

  /** "Not interested" button inside the modal. */
  notInterestedButton: [
    'button:has-text("Not interested")',
    'a:has-text("Not interested")',
  ].join(', '),

  /** Already-applied indicator inside the modal. */
  alreadyApplied: [
    'button:has-text("Applied")',
    'button[disabled]:has-text("Apply")',
    'span:has-text("Already applied")',
  ].join(', '),

  // ── Success detection ─────────────────────────────────────────────────────

  /** Toast that appears at bottom-right: "Application sent to [Company]!" */
  successToast: [
    ':has-text("Application sent")',
  ].join(', '),

  // ── Safety ────────────────────────────────────────────────────────────────

  captcha: [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    '[data-sitekey]',
    'iframe[src*="challenges.cloudflare.com"]',
  ].join(', '),
} as const;

export const INSTAHYRE_DOMAIN_RE = /instahyre\.com/;
export const INSTAHYRE_LOGIN_URL = 'https://www.instahyre.com/login/';
export const INSTAHYRE_JOBS_URL  = 'https://www.instahyre.com/candidate/opportunities/?company_size=0&job_type=0&location=Anywhere+in+India&search=true&skills=Golang,JavaScript,TypeScript,Next.js,Node.js,Express.js,MongoDB,PostgreSQL,AWS,Redis,DevOps&years=1';
