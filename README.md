# wellfound-auto-apply

Automates one-click job applications on Wellfound using Playwright. Runs locally in your own browser with your own session.

## What it does

- Scrolls through your filtered Wellfound results and applies to every job that has a clean one-click Wellfound apply flow
- Skips: already applied, external applications, mandatory questions, CAPTCHAs
- Leaves optional cover letter / note fields empty
- Takes a screenshot when something unexpected happens

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

## Usage

```bash
pnpm start
```

1. Brave opens — log in to Wellfound if needed
2. Set your filters and navigate to your job results
3. Press **ENTER** in the terminal
4. Watch it go

Your browser session is stored in `~/.wellfound-automation/browser-profile/` and reused on every run.

## Selectors

All DOM selectors are in `src/selectors.ts`. If Wellfound updates its UI, that's the only file to touch.
