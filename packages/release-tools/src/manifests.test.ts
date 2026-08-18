import { describe, expect, it } from 'vitest';
import { kindFromPath, readVersion, writeVersion } from './manifests';

const cargo = '[package]\nname = "kroma-server"\nversion = "0.1.38"\nedition = "2021"\n';
const pkg = '{\n  "name": "@kroma/tizen",\n  "version": "0.1.38",\n  "private": true\n}\n';
const mod =
  '{\n  "id": "tv.kroma.acquisition",\n  "version": "0.1.8",\n  "minServer": "0.1.4"\n}\n';

describe('kindFromPath', () => {
  it('maps a path to its manifest kind', () => {
    expect(kindFromPath('server/Cargo.toml')).toBe('cargo');
    expect(kindFromPath('modules/tv.kroma.x/module.json')).toBe('module');
    expect(kindFromPath('clients/tizen/package.json')).toBe('npm');
  });
});

describe('readVersion', () => {
  it('reads each manifest kind', () => {
    expect(readVersion('cargo', cargo)).toBe('0.1.38');
    expect(readVersion('npm', pkg)).toBe('0.1.38');
    expect(readVersion('module', mod)).toBe('0.1.8');
  });

  it('does not read a dependency version by mistake', () => {
    const withDeps = `${cargo}\n[dependencies]\naxum = "0.7.0"\n`;
    expect(readVersion('cargo', withDeps)).toBe('0.1.38');
  });
});

describe('writeVersion', () => {
  it('rewrites only the package version and preserves the rest', () => {
    const out = writeVersion('cargo', cargo, '0.1.39');
    expect(out).toContain('version = "0.1.39"');
    expect(out).toContain('name = "kroma-server"');
    expect(readVersion('cargo', out)).toBe('0.1.39');
  });

  it('rewrites the json manifests', () => {
    expect(readVersion('npm', writeVersion('npm', pkg, '0.2.0'))).toBe('0.2.0');
    expect(readVersion('module', writeVersion('module', mod, '0.1.9'))).toBe('0.1.9');
  });

  it('leaves minServer untouched when bumping a module', () => {
    expect(writeVersion('module', mod, '0.1.9')).toContain('"minServer": "0.1.4"');
  });
});
