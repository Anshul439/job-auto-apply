import fs from 'fs/promises';
import path from 'path';
import { ApplicationResult } from './application.js';

const FILE_PATH = path.join(process.cwd(), 'skipped-urls.json');

interface SkippedUrl {
  url: string;
  reason: ApplicationResult;
  screenshots: string[];
  timestamp: string;
}

export async function saveSkippedUrl(
  url: string,
  result: ApplicationResult,
  screenshots: string[] = [],
): Promise<void> {
  // Do not store successfully applied jobs
  if (result === 'applied') {
    return;
  }

  let existing: SkippedUrl[] = [];

  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    existing = JSON.parse(data);
  } catch {
    // File does not exist yet
    existing = [];
  }

  // Avoid duplicate URLs
  const alreadyExists = existing.some((entry) => entry.url === url);

  if (alreadyExists) {
    return;
  }

  existing.push({
    url,
    reason: result,
    screenshots,
    timestamp: new Date().toISOString(),
  });

  await fs.writeFile(
    FILE_PATH,
    JSON.stringify(existing, null, 2),
    'utf8',
  );
}