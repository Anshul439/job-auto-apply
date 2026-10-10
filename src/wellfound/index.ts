import readline from 'readline';
import 'dotenv/config';

import { launchBrowser, getActivePage, closeBrowser } from '../browser.js';
import {
  getJobListings,
  openJob,
  isAlreadyApplied,
  findApplyButton,
  getJobMeta,
  getJobId,
} from './wellfound.js';
import {
  openApplication,
  isExternalApplication,
  hasCaptcha,
  hasMandatoryAdditionalFields,
  hasApplicationLimitError,
  hasLocationRestriction,
  submitApplication,
  verifyApplication,
  takeDebugScreenshot,
  dismissModal,
  ApplicationResult,
} from './application.js';
import * as log from '../logger.js';


function waitForEnter(prompt: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}


async function processJob(
  context: Awaited<ReturnType<typeof launchBrowser>>,
  jobUrl: string,
  processed: Set<string>,
): Promise<ApplicationResult> {
  const page = await getActivePage(context);
  const jobId = getJobId(jobUrl);

  // Duplicate guard.
  if (processed.has(jobId)) {
    log.skip('Already processed in this run — skipping');
    return 'already_applied';
  }
  processed.add(jobId);

  // Navigate to the job.
  log.step('Opening job');
  let resolvedUrl: string;
  try {
    resolvedUrl = await openJob(page, jobUrl);
  } catch (err) {
    log.error(`Navigation failed: ${(err as Error).message}`);
    return 'skipped_error';
  }

  // Update processed set with resolved URL in case of redirects.
  processed.add(getJobId(resolvedUrl));

  // Log company / role now that the page has loaded.
  const meta = await getJobMeta(page);
  log.info(`${meta.company} — ${meta.role}`);

  if (await isAlreadyApplied(page)) {
    log.skip('Already applied');
    return 'already_applied';
  }

  log.step('Looking for Apply button');
  const applyBtn = await findApplyButton(page);

  if (!applyBtn) {
    log.skip('No Apply button found');
    return 'skipped_no_apply_button';
  }
  log.step('Apply button found');

  log.step('Opening application');
  const modal = await openApplication(page, context, applyBtn);

  if (!modal) {
    // Either a new tab opened (external) or nothing happened.
    log.skip('External application (new tab opened or no modal)');
    return 'skipped_external';
  }
  log.step('Application form detected');

  if (await hasCaptcha(modal)) {
    const screenshot = await takeDebugScreenshot(page, 'captcha');
    log.error(`CAPTCHA detected — skipping. Screenshot: ${screenshot}`);
    await dismissModal(page, modal);
    return 'skipped_captcha';
  }

  if (await isExternalApplication(modal)) {
    log.skip('External application (modal contains external link)');
    await dismissModal(page, modal);
    return 'skipped_external';
  }

  if (await hasMandatoryAdditionalFields(modal)) {
    log.skip('Mandatory question / field detected');
    await dismissModal(page, modal);
    return 'skipped_mandatory_fields';
  }
  log.step('No mandatory additional fields');

  if (await hasLocationRestriction(modal)) {
    log.skip('Location / relocation restriction — submit button disabled');
    await dismissModal(page, modal);
    return 'skipped_location_restricted';
  }

  if (await hasApplicationLimitError(modal)) {
    log.error('Wellfound limit reached: too many active applications. Stopping run.');
    await dismissModal(page, modal);
    return 'skipped_rate_limited';
  }

  log.step('Submitting application');
  const submitted = await submitApplication(page, modal);

  if (!submitted) {
    // Check again after clicking — limit error may appear post-click.
    if (await hasApplicationLimitError(modal)) {
      log.error('Wellfound limit reached: too many active applications. Stopping run.');
      await dismissModal(page, modal);
      return 'skipped_rate_limited';
    }
    const screenshot = await takeDebugScreenshot(page, 'submit_failed');
    log.error(`Submission failed or unexpected form state. Screenshot: ${screenshot}`);
    await dismissModal(page, modal).catch(() => undefined);
    return 'skipped_error';
  }

  const verified = await verifyApplication(page);
  if (verified) {
    log.success('Applied');
  } else {
    // Submission appeared successful but we couldn't confirm the "Applied"
    // state change. Treat as success but note it.
    log.success('Applied (could not confirm state change — treating as success)');
  }

  return 'applied';
}


interface Stats {
  applied:                      number;
  already_applied:              number;
  skipped_mandatory_fields:     number;
  skipped_external:             number;
  skipped_captcha:              number;
  skipped_no_apply_button:      number;
  skipped_rate_limited:         number;
  skipped_location_restricted:  number;
  skipped_error:                number;
}

function printSummary(stats: Stats): void {
  log.sectionHeader('Finished');
  log.summaryLine('Applied',                    stats.applied,                  '\x1b[32m');
  log.summaryLine('Already applied',            stats.already_applied,          '\x1b[90m');
  log.summaryLine('Skipped — mandatory fields', stats.skipped_mandatory_fields, '\x1b[33m');
  log.summaryLine('Skipped — external app',     stats.skipped_external,         '\x1b[33m');
  log.summaryLine('Skipped — CAPTCHA',          stats.skipped_captcha,          '\x1b[31m');
  log.summaryLine('Skipped — no Apply button',  stats.skipped_no_apply_button,      '\x1b[90m');
  log.summaryLine('Skipped — location',         stats.skipped_location_restricted,  '\x1b[33m');
  log.summaryLine('Skipped — rate limited',     stats.skipped_rate_limited,         '\x1b[31m');
  log.summaryLine('Skipped — error',            stats.skipped_error,                '\x1b[31m');
  log.divider();
}


async function main(): Promise<void> {
  log.banner();

  log.raw('\n1. Launching browser…');
  const context = await launchBrowser();
  const page    = await getActivePage(context);

  // Navigate to Wellfound so the user can log in if needed.
  const currentUrl = page.url();
  if (!currentUrl.includes('wellfound.com')) {
    await page.goto('https://wellfound.com/login', { waitUntil: 'domcontentloaded' })
              .catch(() => undefined);
  }

  log.raw('\n2. If you are not logged in, please log in to Wellfound in the browser.');
  log.raw('3. Navigate to your filtered job-results page.');
  log.divider();

  await waitForEnter('   Press ENTER when you are on the filtered results page and ready to start…');

  const jobUrls = await getJobListings(page);

  if (jobUrls.length === 0) {
    log.error('No job listings found on the current page. Make sure you are on a Wellfound filtered-results page.');
    await closeBrowser(context);
    process.exit(1);
  }

  log.raw(`\nStarting automation — ${jobUrls.length} job(s) to process.\n`);

  const processed = new Set<string>();

  const stats: Stats = {
    applied:                  0,
    already_applied:          0,
    skipped_mandatory_fields: 0,
    skipped_external:         0,
    skipped_captcha:          0,
    skipped_no_apply_button:      0,
    skipped_rate_limited:         0,
    skipped_location_restricted:  0,
    skipped_error:                0,
  };

  for (let i = 0; i < jobUrls.length; i++) {
    const jobUrl = jobUrls[i];
    try {
      log.jobHeader(i + 1, jobUrls.length, jobUrl);

      let result: ApplicationResult;

      try {
        result = await processJob(context, jobUrl, processed);
      } catch (err) {
        log.error(`Unexpected error: ${(err as Error).message}`);

        try {
          const activePage = await getActivePage(context);
          const screenshot = await takeDebugScreenshot(activePage, 'unexpected_error');
          log.info(`Screenshot saved: ${screenshot}`);
          log.info(`Job URL: ${jobUrl}`);
        } catch { /* ignore */ }

        result = 'skipped_error';
      }

      stats[result]++;

      // Stop the entire run if Wellfound's application limit was hit.
      if (result === 'skipped_rate_limited') break;

      // Pause briefly between jobs so the site isn't hammered.
      await new Promise((r) => setTimeout(r, 1500));

    } catch (fatalErr) {
      // Absolute last-resort catch.
      log.error(`Fatal error on job ${jobUrl}: ${(fatalErr as Error).message}`);
      stats.skipped_error++;
    }
  }

  printSummary(stats);

  await closeBrowser(context);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
