// Where `bun run logsink` leaves its address for a build running in another
// terminal, and how a shell reads it back. Git-ignored, so it never ships.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** File name written into a shell directory by the log collector. */
export const HANDOFF = '.kroma-log-sink';

/** The collector to report to: the environment first, then whatever `bun run
 *  logsink` left in `shellDir`, then nothing at all. */
export function logSink(shellDir: string): string {
  const fromEnv = process.env.KROMA_TV_LOG_SINK;
  if (fromEnv) return fromEnv;
  const handoff = join(shellDir, HANDOFF);
  return existsSync(handoff) ? readFileSync(handoff, 'utf8').trim() : '';
}
