import { describe, expect, it } from 'vitest';
import { satisfies } from './range';

describe('satisfies', () => {
  it('handles exact and wildcard', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
    expect(satisfies('9.9.9', '*')).toBe(true);
    expect(satisfies('9.9.9', '')).toBe(true);
  });

  it('handles caret on a non-zero major', () => {
    expect(satisfies('1.5.0', '^1.2.3')).toBe(true);
    expect(satisfies('1.2.3', '^1.2.3')).toBe(true);
    expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfies('1.2.2', '^1.2.3')).toBe(false);
  });

  it('handles caret on 0.x (the module case, ^0.1.0)', () => {
    expect(satisfies('0.1.8', '^0.1.0')).toBe(true);
    expect(satisfies('0.1.0', '^0.1.0')).toBe(true);
    expect(satisfies('0.2.0', '^0.1.0')).toBe(false);
    expect(satisfies('0.0.9', '^0.1.0')).toBe(false);
  });

  it('handles tilde and >=', () => {
    expect(satisfies('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.3')).toBe(false);
    expect(satisfies('0.1.4', '>=0.1.4')).toBe(true);
    expect(satisfies('0.1.3', '>=0.1.4')).toBe(false);
  });

  it('tolerates a leading v and drops a pre-release suffix', () => {
    expect(satisfies('v1.2.3', '^1.0.0')).toBe(true);
    expect(satisfies('1.2.3-rc1', '^1.2.3')).toBe(true);
  });
});
