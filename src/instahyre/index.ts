import path from 'path';
import readline from 'readline';
import 'dotenv/config';

import { launchBrowser, getActivePage, closeBrowser } from '../browser.js';
import {
  getCardCount,
  getCardIdentifier,
  openJobModal,
  isModalOpen,
  closeModal,
  getJobMetaFromModal,
  isAlreadyApplied,
  findApplyButton,
  hasCaptcha,
  applyAndConfirm,
  goToNextPage,
} from './jobs.js';
import { INSTAHYRE_JOBS_URL } from './selectors.js';
import * as log from '../logger.js';

const SCREENSHOTS_DIR = path.resolve('screenshots');

function waitForEnter(prompt: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

async function screenshot(page: Awaited<ReturnType<typeof getActivePage>>, label: string) {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = label.replace(/[^a-z0-9-_]/gi, '_').slice(0, 60);
  const file = path.join(SCREENSHOTS_DIR, `${ts}_ih_${safe}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
  return file;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

interface Stats {
  applied:                  number;
  already_applied:          number;
  skipped_no_apply_button:  number;
  skipped_captcha:          number;
  skipped_error:            number;
}

function printSummary(stats: Stats): void {
  log.sectionHeader('Finished');
  log.summaryLine('Applied',                   stats.applied,                 '\x1b[32m');
  log.summaryLine('Already applied',           stats.already_applied,         '\x1b[90m');
  log.summaryLine('Skipped — no Apply button', stats.skipped_no_apply_button, '\x1b[90m');
  log.summaryLine('Skipped — CAPTCHA',         stats.skipped_captcha,         '\x1b[31m');
  log.summaryLine('Skipped — error',           stats.skipped_error,           '\x1b[31m');
  log.divider();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.banner();
  log.raw('  (Instahyre mode)\n');

  log.raw('1. Launching browser…');
  const context = await launchBrowser();
  const page    = await getActivePage(context);

  await page.goto(INSTAHYRE_JOBS_URL, { waitUntil: 'domcontentloaded' }).catch(() => undefined);

  log.raw('\n2. Log in to Instahyre if needed.');
  log.raw('3. Your saved filter URL is loading — adjust filters in the browser if needed.');
  log.raw('4. Wait for results to appear.');
  log.divider();

  await waitForEnter('   Press ENTER when your filtered results are showing…');

  const appliedSet = new Set<string>();
  const stats: Stats = {
    applied: 0, already_applied: 0,
    skipped_no_apply_button: 0, skipped_captcha: 0, skipped_error: 0,
  };

  let pageNum = 1;

  // ── Page-by-page loop ───────────────────────────────────────────────────
  while (true) {
    const count = await getCardCount(page);

    if (count === 0) {
      log.info(`No job cards on page ${pageNum}. Stopping.`);
      break;
    }

    log.raw(`\nPage ${pageNum} — ${count} job(s)\n`);

    // ── Card-by-card loop ─────────────────────────────────────────────────
    let offset = 0;
    let processed = 0;
    let newJobsOnThisPage = 0;

    while (processed < count) {
      try {
        // Ensure any stale modal is closed.
        if (await isModalOpen(page)) {
          await closeModal(page);
        }

        // Check how many View buttons are currently in the DOM.
        const remaining = await getCardCount(page);
        if (offset >= remaining) break;

        // Read card text from the LISTING PAGE for dedup (always available,
        // no async loading). This avoids the "Hold on, loading..." problem.
        const cardId = await getCardIdentifier(page, offset);
        if (appliedSet.has(cardId)) {
          log.jobHeader(processed + 1, count, cardId.split(' | ')[0]);
          log.skip('Already processed this run');
          stats.already_applied++;
          offset++;
          processed++;
          continue;
        }

        // Open the card at the current offset.
        const opened = await openJobModal(page, offset);
        if (!opened) {
          log.error(`Card ${processed + 1}: modal did not open`);
          stats.skipped_error++;
          offset++;
          processed++;
          continue;
        }

        // Read richer metadata from the modal for logging.
        const meta = await getJobMetaFromModal(page);
        log.jobHeader(processed + 1, count, `${meta.company} — ${meta.role}`);

        // Already applied (Instahyre state).
        if (await isAlreadyApplied(page)) {
          log.skip('Already applied');
          appliedSet.add(cardId);
          stats.already_applied++;
          await closeModal(page);
          offset++;   // button didn't change, step past it
          processed++;
          continue;
        }

        // CAPTCHA.
        if (await hasCaptcha(page)) {
          const ss = await screenshot(page, 'captcha');
          log.error(`CAPTCHA detected. Screenshot: ${ss}`);
          stats.skipped_captcha++;
          await closeModal(page);
          offset++;
          processed++;
          continue;
        }

        // Find Apply button inside modal.
        log.step('Looking for Apply button');
        const applyBtn = await findApplyButton(page);
        if (!applyBtn) {
          log.skip('No Apply button found');
          stats.skipped_no_apply_button++;
          await closeModal(page);
          offset++;
          processed++;
          continue;
        }
        log.step('Apply button found — submitting');

        // Apply.
        const success = await applyAndConfirm(page, applyBtn);
        if (success) {
          appliedSet.add(cardId);
          log.success('Applied');
          stats.applied++;
          newJobsOnThisPage++;
          // Applied → card's View button changes state, removed from
          // the selector results. Don't increment offset.
        } else {
          const ss = await screenshot(page, 'apply_failed');
          log.error(`Apply did not confirm. Screenshot: ${ss}`);
          stats.skipped_error++;
          offset++;   // couldn't apply, step past it
        }

        processed++;
        await closeModal(page);
        await page.waitForTimeout(800);

      } catch (err) {
        log.error(`Card ${processed + 1}: ${(err as Error).message}`);
        await screenshot(page, `error_card_${processed + 1}`);
        stats.skipped_error++;
        offset++;
        processed++;
        if (await isModalOpen(page)) {
          await closeModal(page).catch(() => undefined);
        }
      }
    }

    // ── Next page ─────────────────────────────────────────────────────────
    // If we processed an entire page with zero new applications, stop.
    // This prevents looping infinitely through pages of already-seen jobs.
    if (newJobsOnThisPage === 0) {
      log.info('No new jobs found on this page. Stopping pagination.');
      break;
    }

    const hasNext = await goToNextPage(page, pageNum);
    if (!hasNext) break;
    pageNum++;
  }

  printSummary(stats);
  await closeBrowser(context);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
