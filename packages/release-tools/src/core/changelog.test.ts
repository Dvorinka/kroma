import { describe, expect, it } from 'vitest';
import { prepend, renderEntry } from './changelog';
import { parseCommits } from './commits';

const commits = parseCommits([
  'feat(tv): android tv home channel',
  'fix(server): stop serving silence',
  'feat(server)!: reissue all tokens',
  'docs: tidy the readme',
]);

describe('renderEntry', () => {
  const entry = renderEntry('0.2.0', '2026-08-18', commits);

  it('headings the version and date', () => {
    expect(entry).toContain('## 0.2.0 (2026-08-18)');
  });

  it('groups by section and skips empty ones', () => {
    expect(entry).toContain('### Features');
    expect(entry).toContain('### Bug Fixes');
    expect(entry).toContain('### ⚠️ Breaking Changes');
    expect(entry).not.toContain('### Performance');
  });

  it('keeps the scope and drops release-neutral commits', () => {
    expect(entry).toContain('**tv:** android tv home channel');
    expect(entry).not.toContain('tidy the readme');
  });

  it('places an optional summary under the heading, above the sections', () => {
    const withSummary = renderEntry('0.2.0', '2026-08-18', commits, {
      summary: 'A big TV release.',
    });
    expect(withSummary.indexOf('A big TV release.')).toBeGreaterThan(
      withSummary.indexOf('## 0.2.0'),
    );
    expect(withSummary.indexOf('A big TV release.')).toBeLessThan(withSummary.indexOf('### '));
  });
});

describe('prepend', () => {
  it('inserts a new entry under the header, above older ones', () => {
    const existing = '# Changelog\n\n## 0.1.0 (2026-01-01)\n\n### Features\n\n- old\n';
    const out = prepend(existing, '## 0.2.0 (2026-08-18)\n\n### Features\n\n- new\n');
    expect(out.indexOf('0.2.0')).toBeLessThan(out.indexOf('0.1.0'));
    expect(out.startsWith('# Changelog')).toBe(true);
  });
});
