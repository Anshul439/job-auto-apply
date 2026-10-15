## Website & Autofill Extension

[![Apply to jobs in seconds with Zapply.](assets/apply-faster-banner.png)](https://app.zapply.jobs/onboarding?ref=github-cta-anshul439)

Explore Zapply’s website and check out:

- Our Chrome extension, which autofills job applications in seconds.
- A dedicated job board featuring the latest openings across various roles.
- User accounts with multiple profiles for different resume types and roles.
- Job application tracking with streaks and commitment awards.

Experience an advanced career journey with us! 🚀

<p align="center">
  <a href="https://app.zapply.jobs/onboarding?ref=github-cta-anshul439">
    <img src="assets/get-started-button.png" alt="Visit Zapply" width="700">
  </a>
</p>

<p align="right"><sub>Sponsored by Zapply</sub></p>

# job-auto-apply

Automates one-click job applications on **Wellfound** and **Instahyre** using Playwright. Runs locally in your own browser with your own session — no AI, no backend, completely free.

## What it does

- Scrolls through your filtered job results and applies to every job with a clean one-click apply flow
- Skips: already applied, external applications, mandatory questions, CAPTCHAs
- Leaves optional cover letter / note fields empty
- Takes a screenshot when something unexpected happens
- Works across pages (handles pagination and lazy loading)

## Requirements

- Node.js ≥ 18
- pnpm
- Brave, Chrome, or Chromium (optional — auto-detected if installed)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

## Usage

**Wellfound:**
```bash
pnpm start:wellfound
```
1. Browser opens — log in to Wellfound if needed
2. Set your filters and navigate to your job results
3. Press **ENTER** in the terminal
4. Watch it go

**Instahyre:**
```bash
pnpm start:instahyre
```
1. Browser opens and loads your saved Instahyre filter URL — log in if needed
2. Update `INSTAHYRE_JOBS_URL` in `src/instahyre/selectors.ts` with your own filter URL
3. Press **ENTER** when results are showing
4. Watch it go

Your browser session is stored in `~/.wellfound-automation/browser-profile/` and reused on every run — no need to log in again after the first time.

## Browser

Auto-detects in order: **Brave → Chrome → Chromium**, then falls back to Playwright's Chromium. Works on macOS, Linux, and Windows.

To use a custom browser path, set `BROWSER_PATH` in your `.env`:
```
BROWSER_PATH=/path/to/browser
```

## Selectors

- Wellfound: `src/wellfound/selectors.ts`
- Instahyre: `src/instahyre/selectors.ts`

If a site updates its UI, that's the only file to touch.
