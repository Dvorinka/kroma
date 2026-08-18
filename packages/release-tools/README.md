# release-tools

A small, project-agnostic toolkit for Conventional-Commit releases. It derives a
per-package SemVer bump and a changelog entry from commit messages, writes the
new version into the package's native manifest, and can ask a local CLI agent for
a one-sentence human summary. Nothing here is Kroma-specific — the core knows
nothing about git, the filesystem, or this repo.

## Layers

```
src/
  core/        pure domain — no git, no fs, no project specifics
    types.ts       ParsedCommit, BumpLevel, Section, ReleaseConfig
    commits.ts     parse Conventional Commits
    semver.ts      decide + apply the bump (bump rules come from the config)
    changelog.ts   render an entry / prepend to a changelog (sections from the config)
  manifests/   text updaters for the version field, pluggable by extension
    index.ts       ManifestUpdater interface + cargo (TOML) + json built-ins
  io/          the only side-effecting code, all injectable
    git.ts         read commit messages for a range (inject your own Exec)
    summarize.ts   a Summariser backed by a local CLI agent (never an HTTP API)
  config.ts    the conventional defaults, spread-and-override to retune
  index.ts     the public library API
  cli.ts       the reference consumer (thin git + fs wiring)
```

The dependency arrow points inward: `core` imports nothing from `io` or
`manifests`; `cli` composes them. That is what makes the release logic testable
without a repo and portable to another project.

## Reuse in another project

```ts
import { parseCommits, nextVersion, renderEntry, updaterFor } from '@kroma/release-tools';
import { readFileSync, writeFileSync } from 'node:fs';

const updater = updaterFor('Cargo.toml');
const text = readFileSync('Cargo.toml', 'utf8');
const current = updater.read(text)!;
const commits = parseCommits(myCommitMessages);
const next = nextVersion(current, commits);
if (next) writeFileSync('Cargo.toml', updater.write(text, next));
```

Everything is overridable through a `ReleaseConfig`: the bump map (`bumpOf`), the
changelog `sections`, the changelog `header`. Add a manifest format by
implementing `ManifestUpdater`. Swap the AI summary for any backend by passing a
different `Summariser`.

## CLI

```
release-tools --manifest <path> --since <ref> \
  [--paths a,b] [--changelog CHANGELOG.md] [--summarize] [--write]
```

`--summarize` shells to the local `claude` CLI (`claude -p`), not the Anthropic
API; it is best-effort and falls back to the raw commits, so it is never on a CI
critical path.
