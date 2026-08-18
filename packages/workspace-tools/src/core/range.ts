// A minimal SemVer range checker — just the operators the manifests actually use
// (exact, ^, ~, >=, *). Pure and self-contained so dependency verification has no
// runtime dependency and is trivially testable.

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parse(version: string): SemVer | null {
  const match = version
    .trim()
    .replace(/^[v=]/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compare(a: SemVer, b: SemVer): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

// Caret: compatible within the left-most non-zero segment.
//   ^1.2.3 → >=1.2.3 <2.0.0 ; ^0.1.2 → >=0.1.2 <0.2.0 ; ^0.0.3 → >=0.0.3 <0.0.4
function caretUpper(base: SemVer): SemVer {
  if (base.major > 0) return { major: base.major + 1, minor: 0, patch: 0 };
  if (base.minor > 0) return { major: 0, minor: base.minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: base.patch + 1 };
}

// Tilde: allow patch-level changes.  ~1.2.3 → >=1.2.3 <1.3.0
function tildeUpper(base: SemVer): SemVer {
  return { major: base.major, minor: base.minor + 1, patch: 0 };
}

export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (!v) return false;
  const r = range.trim();
  if (r === '' || r === '*' || r === 'latest') return true;

  if (r.startsWith('^') || r.startsWith('~')) {
    const base = parse(r.slice(1));
    if (!base) return false;
    const upper = r.startsWith('^') ? caretUpper(base) : tildeUpper(base);
    return compare(v, base) >= 0 && compare(v, upper) < 0;
  }
  if (r.startsWith('>=')) {
    const base = parse(r.slice(2));
    return base ? compare(v, base) >= 0 : false;
  }
  const exact = parse(r);
  return exact ? compare(v, exact) === 0 : false;
}
