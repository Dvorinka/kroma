import type { ParsedCommit } from './conventional';

// Render one changelog entry from a set of commits. Pure: the same commits and
// version always produce the same markdown, so it is unit-testable and CI can
// assert the file is up to date the way spec:check does for the spec index.

interface Section {
  title: string;
  match: (commit: ParsedCommit) => boolean;
}

const SECTIONS: Section[] = [
  { title: 'Features', match: (c) => c.type === 'feat' && !c.breaking },
  { title: 'Bug Fixes', match: (c) => c.type === 'fix' },
  { title: 'Performance', match: (c) => c.type === 'perf' },
];

function line(commit: ParsedCommit): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : '';
  const bang = commit.breaking ? ' ⚠️ BREAKING' : '';
  return `- ${scope}${commit.subject}${bang}`;
}

// `summary` is the optional one-sentence human line (e.g. from the claude CLI):
// it sits under the heading, above the categorised list, and is simply omitted
// when absent so the entry is still complete from the commits alone.
export function renderEntry(
  version: string,
  date: string,
  commits: ParsedCommit[],
  summary?: string,
): string {
  const out: string[] = [`## ${version} (${date})`, ''];
  if (summary) out.push(summary, '');

  const breaking = commits.filter((c) => c.breaking);
  if (breaking.length) {
    out.push('### ⚠️ Breaking Changes', '');
    for (const c of breaking) out.push(line(c));
    out.push('');
  }

  for (const section of SECTIONS) {
    const items = commits.filter(section.match);
    if (items.length === 0) continue;
    out.push(`### ${section.title}`, '');
    for (const c of items) out.push(line(c));
    out.push('');
  }
  return out.join('\n');
}

// Prepend a new entry above the existing changelog body, keeping a stable
// `# Changelog` header at the top.
export function prepend(existing: string, entry: string): string {
  const header = '# Changelog';
  const body = existing.replace(/^# Changelog\n*/, '').trimStart();
  return `${header}\n\n${entry.trimEnd()}\n\n${body}`.trimEnd().concat('\n');
}
