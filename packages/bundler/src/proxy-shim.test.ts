import { installProxyShim, proxyShim } from '@kroma/bundler/proxy-shim';
import { describe, expect, it } from 'vitest';

describe('proxyShim', () => {
  it('reports every read through the get trap', () => {
    const read: string[] = [];
    const view = proxyShim(
      { isFocused: true, isActive: false },
      {
        get: (target, key) => {
          read.push(key);
          return (target as Record<string, unknown>)[key];
        },
      },
    );
    expect(view.isFocused).toBe(true);
    expect(view.isActive).toBe(false);
    expect(read).toEqual(['isFocused', 'isActive']);
  });

  it('falls back to the target when a trap is absent', () => {
    const view = proxyShim({ a: 1 }, {});
    expect(view.a).toBe(1);
    view.a = 2;
    expect(view.a).toBe(2);
  });

  it('routes writes through the set trap', () => {
    const written: unknown[] = [];
    const view = proxyShim(
      { a: 1 },
      {
        set: (_target, _key, value) => {
          written.push(value);
          return true;
        },
      },
    );
    view.a = 9;
    expect(written).toEqual([9]);
    expect(view.a).toBe(1);
  });

  it('keeps the keys enumerable, so the object still spreads', () => {
    const view = proxyShim({ a: 1, b: 2 }, {});
    expect(Object.keys(view)).toEqual(['a', 'b']);
    expect({ ...view }).toEqual({ a: 1, b: 2 });
    expect('a' in view).toBe(true);
  });

  it('answers `new`, which is how the call sites spell it', () => {
    const Ctor = proxyShim as unknown as new <T extends object>(t: T, h: object) => T;
    const view = new Ctor({ a: 1 }, {});
    expect(view.a).toBe(1);
  });
});

describe('installProxyShim', () => {
  it('leaves a native Proxy alone', () => {
    const native = globalThis.Proxy;
    installProxyShim();
    expect(globalThis.Proxy).toBe(native);
  });

  it('defines one where the engine has none', () => {
    const native = globalThis.Proxy;
    // @ts-expect-error -- simulating an engine below Chromium 49
    delete globalThis.Proxy;
    let read: unknown;
    try {
      installProxyShim();
      read = new Proxy({ a: 1 }, {}).a;
    } finally {
      // Restored before asserting: vitest's own expect() is built on Proxy.
      globalThis.Proxy = native;
    }
    expect(read).toBe(1);
  });
});
