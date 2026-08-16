/**
 * Phase 14 (Messaging Platform), Stage 14.4: the brief's hard
 * architectural constraint — "Messaging must publish domain events...
 * the Notification Platform must subscribe to these events without
 * Messaging knowing anything about notifications" — enforced
 * structurally here, not just by convention. Scans every real source
 * file under `src/modules/messaging` (excluding this test itself) and
 * fails if any of them imports from the `notifications` module.
 */

import { describe, test, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGING_SRC_DIR = path.resolve(
  __dirname,
  '../../../../src/modules/messaging',
);

function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) return listSourceFiles(fullPath);
    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

describe('Messaging module dependency direction', () => {
  test('no file under src/modules/messaging imports from the notifications module', () => {
    const offenders = listSourceFiles(MESSAGING_SRC_DIR).filter((filePath) =>
      /from\s+['"][^'"]*\/notifications\//.test(readFileSync(filePath, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
