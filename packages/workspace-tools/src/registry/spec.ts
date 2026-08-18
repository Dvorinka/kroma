// Parse a dependency value the way npm's dependency-string grammar does: the
// common case is a bare SemVer range, with two opt-in inline sources for the
// rare one-off. Pure and total — an unrecognised shape is treated as a range,
// never throws.

export type DependencySource =
  // A bare range: resolved through the registries routing (default = Kroma).
  | { kind: 'default' }
  // `<range>@<registry-url>` — pin this one dependency to a specific registry.
  | { kind: 'registry'; url: string }
  // `git+<url>#<range>` — a one-off git source.
  | { kind: 'git'; url: string };

export interface DependencySpec {
  range: string;
  source: DependencySource;
}

export function parseDependency(value: string): DependencySpec {
  const spec = value.trim();

  // git+https://…/repo#^0.3.0  (the range is the fragment; absent → any)
  if (spec.startsWith('git+')) {
    const hash = spec.lastIndexOf('#');
    const hasRange = hash > 'git+'.length;
    return {
      range: hasRange ? spec.slice(hash + 1) : '*',
      source: { kind: 'git', url: hasRange ? spec.slice(4, hash) : spec.slice(4) },
    };
  }

  // ^2.0.0@https://npm.corp  — only when the `@` introduces a URL scheme, so a
  // future scoped id in a value can never be mistaken for a registry pin.
  const at = spec.search(/@(?=https?:\/\/)/);
  if (at > 0) {
    return { range: spec.slice(0, at), source: { kind: 'registry', url: spec.slice(at + 1) } };
  }

  return { range: spec, source: { kind: 'default' } };
}
