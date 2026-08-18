import { defaultConfig } from '../config';
import type { BumpLevel, ParsedCommit, ReleaseConfig } from './types';

const RANK: Record<BumpLevel, number> = { patch: 1, minor: 2, major: 3 };

// The bump a set of commits earns under a config: the strongest intent among
// them, or null when nothing is release-worthy. The mapping lives in the config
// so a project can, say, treat `docs:` as a patch without forking this.
export function decideBump(
  commits: ParsedCommit[],
  config: ReleaseConfig = defaultConfig,
): BumpLevel | null {
  let best: BumpLevel | null = null;
  for (const commit of commits) {
    const level = config.bumpOf(commit);
    if (level && (best === null || RANK[level] > RANK[best])) best = level;
  }
  return best;
}

// Apply a bump to an X.Y.Z version, dropping any pre-release/build suffix (a
// release opens a clean number). Throws on a non-SemVer input so a bad manifest
// fails loudly rather than producing `NaN.0.0`.
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
export function nextVersion(
  current: string,
  commits: ParsedCommit[],
  config: ReleaseConfig = defaultConfig,
): string | null {
  const level = decideBump(commits, config);
  return level ? applyBump(current, level) : null;
}
