import type { BumpLevel, ParsedCommit, ReleaseConfig, Section } from './core/types';

// The conventional defaults (SemVer + the Angular changelog sections). A project
// reuses these as-is, or spreads and overrides one field — e.g. its own bumpOf.

export function defaultBumpOf(commit: ParsedCommit): BumpLevel | null {
  if (commit.breaking) return 'major';
  if (commit.type === 'feat') return 'minor';
  if (commit.type === 'fix' || commit.type === 'perf') return 'patch';
  return null;
}

export const defaultSections: Section[] = [
  { title: '⚠️ Breaking Changes', include: (c) => c.breaking },
  { title: 'Features', include: (c) => c.type === 'feat' && !c.breaking },
  { title: 'Bug Fixes', include: (c) => c.type === 'fix' && !c.breaking },
  { title: 'Performance', include: (c) => c.type === 'perf' && !c.breaking },
];

export const defaultConfig: ReleaseConfig = {
  bumpOf: defaultBumpOf,
  sections: defaultSections,
  changelogHeader: '# Changelog',
};
