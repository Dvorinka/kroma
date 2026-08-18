// The one global the deep tier cannot get from a polyfill system. Proxy is
// Chromium 49 and that tier's engine is 47, and core-js carries no Proxy module
// at all - trapping property access on an arbitrary object needs the engine.
//
// What a shim can honour is the keys a target already has when it is
// constructed: an accessor each, forwarding to the handler. That is the only
// shape left in the TV bundle, a fixed record whose reads are being observed
// (react-tv-space-navigation watches which of `isFocused`/`isActive`/
// `isRootActive` a node reads), and it is deliberately not more: a key added
// afterwards is untrapped, and `has`/`ownKeys`/`deleteProperty` stay the
// engine's own.

export interface ProxyShimHandler<T extends object> {
  get?: (target: T, key: string, receiver: unknown) => unknown;
  set?: (target: T, key: string, value: unknown, receiver: unknown) => boolean;
}

type Keyed = Record<string, unknown>;

/** Stands in for `new Proxy(target, handler)` over `target`'s existing keys. */
export function proxyShim<T extends object>(target: T, handler: ProxyShimHandler<T>): T {
  const view: Keyed = {};
  for (const key of Object.keys(target)) {
    Object.defineProperty(view, key, {
      enumerable: true,
      configurable: true,
      get: () => (handler.get ? handler.get(target, key, view) : (target as Keyed)[key]),
      set: (value: unknown) => {
        if (handler.set) handler.set(target, key, value, view);
        else (target as Keyed)[key] = value;
      },
    });
  }
  return view as T;
}

function globalScope(): Keyed | undefined {
  if (typeof globalThis !== 'undefined') return globalThis as unknown as Keyed;
  if (typeof window !== 'undefined') return window as unknown as Keyed;
  return undefined;
}

/** Defines a global `Proxy` where the engine has none. A no-op anywhere else,
 *  so both older tiers can call it and only the deepest one is changed. */
export function installProxyShim(): void {
  if (typeof Proxy !== 'undefined') return;
  const scope = globalScope();
  if (scope) scope.Proxy = proxyShim;
}
