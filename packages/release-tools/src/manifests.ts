// Read and write the `version` field of the three native manifests this repo
// uses, treating each file as text so the rest of the file (formatting,
// comments, key order) is preserved exactly. String-in, string-out and pure, so
// it is unit-testable without touching the filesystem.

export type ManifestKind = 'cargo' | 'npm' | 'module';

// The first top-level `version = "..."` for Cargo (the [package] version sits
// above the dependency table); the first `"version": "..."` for JSON manifests
// (package.json and module.json both put it near the top).
const CARGO = /^version[ \t]*=[ \t]*"([^"]+)"/m;
const JSON_VERSION = /"version"[ \t]*:[ \t]*"([^"]+)"/;

export function kindFromPath(path: string): ManifestKind {
  if (path.endsWith('Cargo.toml')) return 'cargo';
  if (path.endsWith('module.json')) return 'module';
  return 'npm';
}

export function readVersion(kind: ManifestKind, text: string): string | null {
  const match = text.match(kind === 'cargo' ? CARGO : JSON_VERSION);
  return match ? match[1] : null;
}

export function writeVersion(kind: ManifestKind, text: string, version: string): string {
  if (kind === 'cargo') {
    return text.replace(/^(version[ \t]*=[ \t]*")[^"]+(")/m, `$1${version}$2`);
  }
  return text.replace(/("version"[ \t]*:[ \t]*")[^"]+(")/, `$1${version}$2`);
}
