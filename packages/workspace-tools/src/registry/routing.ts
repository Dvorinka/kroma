// Route a module id to the registry that serves it, Gradle-style: a map of
// reverse-DNS group prefixes to registry URLs, longest-prefix-wins, with a
// default (the Kroma registry) for everything unmatched. Pure.

export interface Registries {
  // The fallback registry for any id no prefix matches (and for tv.kroma.* by
  // convention, if not overridden).
  default: string;
  // group prefix → registry URL, e.g. { "com.acme": "https://modules.acme.dev" }.
  byPrefix?: Record<string, string>;
}

// Whether `id` is inside the reverse-DNS `prefix` (exact, or a `.`-delimited
// child — so "com.ac" does not match "com.acme.foo").
function underPrefix(id: string, prefix: string): boolean {
  return id === prefix || id.startsWith(`${prefix}.`);
}

export function registryFor(id: string, registries: Registries): string {
  let url = registries.default;
  let matched = -1;
  for (const [prefix, candidate] of Object.entries(registries.byPrefix ?? {})) {
    if (underPrefix(id, prefix) && prefix.length > matched) {
      url = candidate;
      matched = prefix.length;
    }
  }
  return url;
}
