import path from 'path';
import os   from 'os';
import fs   from 'fs';
import { chromium, BrowserContext } from 'playwright';
import * as log from './logger.js';

/** Where the persistent browser profile is stored. */
const PROFILE_DIR = path.join(os.homedir(), '.wellfound-automation', 'browser-profile');

/**
 * Resolves a Chromium-based browser binary for the current OS.
 *
 * Priority:
 *   1. BROWSER_PATH env variable (any browser, user-specified)
 *   2. Brave (preferred — less bot-detection than Chrome)
 *   3. Google Chrome
 *   4. Chromium
 *
 * Set BROWSER_PATH in your shell or .env to use a custom path:
 *   BROWSER_PATH="/path/to/browser" pnpm start
 */
function getBrowserPath(): string {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;

  const candidates: Record<string, string[]> = {
    darwin: [
      // Brave
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      // Chrome
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      // Chromium
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      // Brave
      '/usr/bin/brave-browser',
      '/usr/bin/brave',
      '/usr/local/bin/brave-browser',
      '/snap/bin/brave',
      // Chrome
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/local/bin/google-chrome',
      // Chromium
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ],
    win32: [
      // Brave
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      `${os.homedir()}\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      // Chrome
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
    ],
  };

  for (const p of candidates[process.platform] ?? []) {
    if (fs.existsSync(p)) return p;
  }

  // Nothing found — Playwright will surface a clear error with the path.
  return candidates[process.platform]?.[0] ?? 'google-chrome';
}

const BROWSER_PATH = getBrowserPath();

/**
 * Launches a persistent browser context so the existing login session
 * is reused across runs.
 */
export async function launchBrowser(): Promise<BrowserContext> {
  log.step(`Using browser profile: ${PROFILE_DIR}`);
  log.step(`Using browser: ${BROWSER_PATH}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: BROWSER_PATH,
    headless: false,
    viewport:  { width: 1440, height: 900 },
    slowMo: 80,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  return context;
}

/**
 * Returns the first page in the context, creating one if the context is empty.
 */
export async function getActivePage(context: BrowserContext) {
  const pages = context.pages();
  return pages.length > 0 ? pages[0] : context.newPage();
}

export async function closeBrowser(context: BrowserContext): Promise<void> {
  await context.close();
}
