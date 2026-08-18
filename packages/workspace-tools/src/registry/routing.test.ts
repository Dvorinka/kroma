import { describe, expect, it } from 'vitest';
import { registryFor } from './routing';

const registries = {
  default: 'https://modules.kroma.tv',
  byPrefix: {
    'com.acme': 'https://modules.acme.dev',
    'com.acme.internal': 'https://internal.acme.dev',
  },
};

describe('registryFor', () => {
  it('falls back to the default for an unmatched id', () => {
    expect(registryFor('tv.kroma.torrents', registries)).toBe('https://modules.kroma.tv');
  });

  it('routes a matching group to its registry', () => {
    expect(registryFor('com.acme.foo', registries)).toBe('https://modules.acme.dev');
  });

  it('prefers the longest matching prefix', () => {
    expect(registryFor('com.acme.internal.x', registries)).toBe('https://internal.acme.dev');
  });

  it('respects the reverse-DNS boundary (no partial-segment match)', () => {
    expect(registryFor('com.acmeworks.foo', registries)).toBe('https://modules.kroma.tv');
  });

  it('matches a prefix exactly', () => {
    expect(registryFor('com.acme', registries)).toBe('https://modules.acme.dev');
  });

  it('works with no prefix map', () => {
    expect(registryFor('anything', { default: 'https://d' })).toBe('https://d');
  });
});
