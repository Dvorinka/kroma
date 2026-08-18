import { defaultConfig } from '../config';
import type { ParsedCommit, ReleaseConfig } from './types';

// Render one changelog entry from a set of commits, sectioned by the config.
// Pure: same commits + version + config always produce the same markdown, so a
// project's CI can assert the changelog is up to date the way a codegen check does.

function line(commit: ParsedCommit): string {
  const scope = commit.scope ? `**${commit.scope}:** ` : '';
  const breaking = commit.breaking ? ' ⚠️ BREAKING' : '';
  return `- ${scope}${commit.subject}${breaking}`;
}

export interface RenderOptions {
  config?: ReleaseConfig;
  // An optional one-sentence human summary (e.g. from a summariser) placed under
  // the heading, above the categorised list. Omitted cleanly when absent.
  summary?: string;
}

export function renderEntry(
  version: string,
  date: string,
  commits: ParsedCommit[],
  options: RenderOptions = {},
): string {
  const config = options.config ?? defaultConfig;
  const out: string[] = [`## ${version} (${date})`, ''];
  if (options.summary) out.push(options.summary, '');

  for (const section of config.sections) {
    const items = commits.filter(section.include);
    if (items.length === 0) continue;
    out.push(`### ${section.title}`, '');
    for (const commit of items) out.push(line(commit));
    out.push('');
  }
  return out.join('\n');
}

// Prepend a new entry beneath the changelog header, above older entries.
export function prepend(
  existing: string,
  entry: string,
  header: string = defaultConfig.changelogHeader,
): string {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = existing.replace(new RegExp(`^${escaped}\\n*`), '').trimStart();
  return `${header}\n\n${entry.trimEnd()}\n\n${body}`.trimEnd().concat('\n');
}
