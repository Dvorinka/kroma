// The tj-actions/changed-files compromise (CVE-2025-30066) worked by rewriting
// every tag in the upstream repo to point at a malicious commit. A tag is a
// mutable pointer, so `uses: foo/bar@v1` silently followed it; a 40-hex commit
// SHA could not be moved and was the one thing that held.
//
// This verifies both halves of that defence: every external action is pinned to
// a SHA, and every pinned SHA still resolves to a real commit upstream. A SHA
// that no longer exists means the pin was forged or the history was rewritten.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKFLOW_DIR = '.github/workflows';
const SHA = /^[0-9a-f]{40}$/;
const USES = /^\s*-?\s*uses:\s*(\S+)/;

type Pin = { repo: string; sha: string; comment: string; sources: Set<string> };

function collectPins(): Map<string, Pin> {
  const pins = new Map<string, Pin>();

  for (const file of readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))) {
    const lines = readFileSync(join(WORKFLOW_DIR, file), 'utf8').split('\n');

    for (const line of lines) {
      const target = line.match(USES)?.[1];
      // Reusable local workflows travel with the commit that runs them.
      if (!target || target.startsWith('./') || target.startsWith('docker://')) continue;

      const at = target.lastIndexOf('@');
      if (at === -1) {
        throw new Error(`${file}: 'uses: ${target}' has no ref at all`);
      }

      const repo = target.slice(0, at).split('/').slice(0, 2).join('/');
      const ref = target.slice(at + 1);
      const key = `${repo}@${ref}`;
      const existing = pins.get(key);
      if (existing) {
        existing.sources.add(file);
        continue;
      }
      pins.set(key, {
        repo,
        sha: ref,
        comment: line.match(/#\s*(\S+)/)?.[1] ?? '',
        sources: new Set([file]),
      });
    }
  }

  return pins;
}

function upstreamRefsAt(repo: string, sha: string): string[] {
  const out = execFileSync(
    'git',
    ['ls-remote', '--tags', '--heads', `https://github.com/${repo}`],
    {
      encoding: 'utf8',
      timeout: 60_000,
    },
  );

  return out
    .split('\n')
    .filter((l) => l.startsWith(sha))
    .map((l) =>
      l
        .split('\t')[1]
        ?.replace(/^refs\/(tags|heads)\//, '')
        .replace(/\^\{\}$/, ''),
    )
    .filter((r): r is string => Boolean(r));
}

// An annotated tag's own object SHA differs from the commit it peels to, so a
// ref listing alone can miss a legitimate pin. Fetching the SHA directly is the
// authoritative existence check.
function commitExists(repo: string, sha: string, workdir: string): boolean {
  try {
    execFileSync('git', ['fetch', '-q', '--depth=1', `https://github.com/${repo}`, sha], {
      cwd: workdir,
      timeout: 90_000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const pins = collectPins();
const workdir = mkdtempSync(join(tmpdir(), 'action-pins-'));
execFileSync('git', ['init', '-q', workdir]);

const errors: string[] = [];
const warnings: string[] = [];

for (const [key, pin] of [...pins].sort()) {
  const where = [...pin.sources].sort().join(', ');

  if (!SHA.test(pin.sha)) {
    errors.push(`${key} is not pinned to a commit SHA (${where})`);
    continue;
  }

  const refs = upstreamRefsAt(pin.repo, pin.sha);
  if (refs.length > 0) {
    console.log(
      `ok       ${pin.repo} @ ${pin.comment || pin.sha.slice(0, 12)} -> ${refs.join(' ')}`,
    );
    continue;
  }

  if (commitExists(pin.repo, pin.sha, workdir)) {
    warnings.push(
      `${key} is a real commit but no upstream tag or branch points at it any more` +
        ` (comment says '${pin.comment}'; the ref has moved on) — ${where}`,
    );
    continue;
  }

  errors.push(`${key} does not exist upstream — forged pin or rewritten history (${where})`);
}

for (const warning of warnings) {
  console.log(`::warning title=Action pin drift::${warning}`);
}
for (const error of errors) {
  console.log(`::error title=Action pin::${error}`);
}

console.log(
  `\n${pins.size} external action pins checked: ` +
    `${pins.size - errors.length - warnings.length} verified, ${warnings.length} drifted, ${errors.length} failed`,
);

if (errors.length > 0) process.exit(1);
