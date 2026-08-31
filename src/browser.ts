import path from 'path';
import os   from 'os';
import { chromium, BrowserContext } from 'playwright';
import * as log from './logger.js';

/** Where the persistent browser profile is stored. */
const PROFILE_DIR = path.join(os.homedir(), '.wellfound-automation', 'browser-profile');

/**
 * Path to the Brave browser binary on macOS.
 * Update this if Brave is installed elsewhere on your system.
 */
const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

/**
 * Launches Brave with a persistent profile so that an existing Wellfound
 * login session is reused across runs.
 *
 * On first run the browser opens to wellfound.com/login so you can log in
 * manually. After logging in, close nothing — just navigate to your filtered
 * results page and press ENTER in the terminal.
 */
export async function launchBrowser(): Promise<BrowserContext> {
  log.step(`Using browser profile: ${PROFILE_DIR}`);
  log.step(`Using Brave at: ${BRAVE_PATH}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: BRAVE_PATH,
    headless: false,
    viewport:  { width: 1440, height: 900 },
    // Small artificial delay between inputs so the site behaves naturally.
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
