# job-auto-apply

Automates one-click job applications on Wellfound and Instahyre using Playwright. Runs locally in your own browser with your own session.

## What it does

- Scrolls through your filtered job results and applies to every job with a clean one-click apply flow
- Skips: already applied, external applications, mandatory questions, CAPTCHAs
- Leaves optional cover letter / note fields empty
- Takes a screenshot when something unexpected happens

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
1. Browser opens and loads your saved filter URL — log in if needed
2. Press **ENTER** when results are showing
3. Watch it go

Your browser session is stored in `~/.wellfound-automation/browser-profile/` and reused on every run.

## Browser

Auto-detects in order: **Brave → Chrome → Chromium**. Works on macOS, Linux, and Windows.

To use a custom browser path set `BROWSER_PATH` in your `.env`:
```
BROWSER_PATH=/path/to/browser
```

## Selectors

- Wellfound: `src/wellfound/selectors.ts`
- Instahyre: `src/instahyre/selectors.ts`

If a site updates its UI, that's the only file to touch.
