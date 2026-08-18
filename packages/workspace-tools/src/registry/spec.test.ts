import { describe, expect, it } from 'vitest';
import { parseDependency } from './spec';

describe('parseDependency', () => {
  it('reads a bare range as the default source', () => {
    expect(parseDependency('^0.1.0')).toEqual({ range: '^0.1.0', source: { kind: 'default' } });
  });

  it('reads a git source with a range fragment', () => {
    expect(parseDependency('git+https://x.dev/bar#^0.3.0')).toEqual({
      range: '^0.3.0',
      source: { kind: 'git', url: 'https://x.dev/bar' },
    });
  });

  it('defaults a git source with no fragment to any', () => {
    expect(parseDependency('git+https://x.dev/bar')).toEqual({
      range: '*',
      source: { kind: 'git', url: 'https://x.dev/bar' },
    });
  });

  it('reads a range pinned to a registry', () => {
    expect(parseDependency('^2.0.0@https://npm.corp')).toEqual({
      range: '^2.0.0',
      source: { kind: 'registry', url: 'https://npm.corp' },
    });
  });

  it('does not treat a non-url @ as a registry pin', () => {
    expect(parseDependency('^1.0.0@beta').source).toEqual({ kind: 'default' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseDependency('  ^1.2.3  ').range).toBe('^1.2.3');
  });
});
