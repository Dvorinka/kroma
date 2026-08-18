import type { ParsedCommit } from './conventional';

export type BumpLevel = 'major' | 'minor' | 'patch';

const RANK: Record<BumpLevel, number> = { patch: 1, minor: 2, major: 3 };

// SemVer intent of a single commit. A breaking change wins outright; a feature
// is a minor; a fix or perf is a patch; everything else (docs, chore, refactor,
// test, ci) is release-neutral and returns null.
function levelOf(commit: ParsedCommit): BumpLevel | null {
  if (commit.breaking) return 'major';
  if (commit.type === 'feat') return 'minor';
  if (commit.type === 'fix' || commit.type === 'perf') return 'patch';
  return null;
}

// The bump a set of commits earns: the strongest intent among them, or null
// when nothing in the set is release-worthy (so the caller ships no release).
export function decideBump(commits: ParsedCommit[]): BumpLevel | null {
  let best: BumpLevel | null = null;
  for (const commit of commits) {
    const level = levelOf(commit);
    if (level && (best === null || RANK[level] > RANK[best])) best = level;
  }
  return best;
}

// Apply a bump to an X.Y.Z version, dropping any pre-release/build suffix (a
// release opens a clean number). Throws on a non-SemVer input so a bad manifest
// fails loudly rather than silently producing `NaN.0.0`.
export function applyBump(version: string, level: BumpLevel): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`not a SemVer version: ${version}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// Convenience: the next version, or null when the commits earn no release.
export function nextVersion(current: string, commits: ParsedCommit[]): string | null {
  const level = decideBump(commits);
  return level ? applyBump(current, level) : null;
}
