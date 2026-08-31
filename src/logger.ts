/**
 * Simple, coloured terminal logger.
 * Uses ANSI escape codes — no external library required.
 */

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const GRAY   = '\x1b[90m';

// ─── Public API ──────────────────────────────────────────────────────────────

export function banner(): void {
  console.log();
  console.log(`${BOLD}Wellfound Auto Apply${RESET}`);
  console.log('────────────────────');
}

export function step(message: string): void {
  console.log(`  ${CYAN}→${RESET} ${message}`);
}

export function success(message: string): void {
  console.log(`  ${GREEN}✓${RESET} ${message}`);
}

export function skip(message: string): void {
  console.log(`  ${YELLOW}⊘${RESET} ${message}`);
}

export function error(message: string): void {
  console.log(`  ${RED}✗${RESET} ${message}`);
}

export function info(message: string): void {
  console.log(`    ${DIM}${message}${RESET}`);
}

/** Prints the job header line: [n/total] URL */
export function jobHeader(current: number, total: number, label: string): void {
  console.log();
  console.log(`${GRAY}[${current}/${total}]${RESET} ${BOLD}${label}${RESET}`);
}

export function sectionHeader(message: string): void {
  console.log();
  console.log(`${BOLD}${message}${RESET}`);
  console.log('─'.repeat(message.length));
}

export function summaryLine(label: string, value: number, colour?: string): void {
  const coloured = colour ? `${colour}${value}${RESET}` : `${value}`;
  console.log(`  ${label.padEnd(32, '.')} ${coloured}`);
}

export function divider(): void {
  console.log();
}

export function raw(message: string): void {
  console.log(message);
}
