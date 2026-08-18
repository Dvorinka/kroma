import { spawnSync } from 'node:child_process';

// Ask the LOCAL `claude` CLI — not the Anthropic API — for a one-sentence,
// user-facing summary of a change. Best-effort by design: if the CLI is absent,
// unauthenticated, times out or errors, this returns null and the changelog
// renders from the raw commits alone. Nothing here is on the CI critical path;
// it is meant to run on a developer's machine (or an agent's) where `claude` is
// already logged in, and the produced line is committed.

export interface SummarizeOptions {
  // Injected for tests; defaults to the real CLI runner.
  run?: (input: string) => { status: number | null; stdout: string };
  timeoutMs?: number;
}

function realRun(input: string, timeoutMs: number) {
  const res = spawnSync('claude', ['-p', input], {
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  return { status: res.status, stdout: res.stdout ?? '' };
}

const PROMPT =
  'Summarise the following change in ONE plain sentence for a user-facing ' +
  'changelog. State what changed and why it matters. No preamble, no markdown, ' +
  'no trailing period beyond the sentence.\n\n';

export function summarize(context: string, options: SummarizeOptions = {}): string | null {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const run = options.run ?? ((input: string) => realRun(input, timeoutMs));
  try {
    const { status, stdout } = run(PROMPT + context);
    if (status !== 0) return null;
    const first = stdout.trim().split('\n')[0].trim();
    return first.length > 0 ? first : null;
  } catch {
    return null;
  }
}
