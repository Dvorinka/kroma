#!/usr/bin/env bun
// The reference consumer: wires git + files + the default config into the
// library. All release logic lives in the tested core/manifests/io modules; this
// file only parses argv, reads/writes files, and prints (or drives the TUI).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { prepend, renderEntry } from './core/changelog';
import { parseCommits } from './core/commits';
import { applyBump, nextVersion, parseLevel } from './core/semver';
import type { BumpLevel } from './core/types';
import { commitsSince } from './io/git';
import { cliSummariser } from './io/summarize';
import { interactiveRelease } from './io/tui';
import { updaterFor } from './manifests';

interface Args {
  manifest?: string;
  changelog?: string;
  since?: string;
  paths?: string;
  bump?: string;
  write?: boolean;
  summarize?: boolean;
  interactive?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--write') args.write = true;
    else if (key === '--summarize') args.summarize = true;
    else if (key === '--interactive' || key === '-i') args.interactive = true;
    else if (key === '--manifest') {
      args.manifest = value;
      i += 1;
    } else if (key === '--changelog') {
      args.changelog = value;
      i += 1;
    } else if (key === '--since') {
      args.since = value;
      i += 1;
    } else if (key === '--paths') {
      args.paths = value;
      i += 1;
    } else if (key === '--bump') {
      args.bump = value;
      i += 1;
    }
  }
  return args;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// DX: default the range start to the newest `vX.Y.Z` tag, so `--since` is
// optional in the common case.
function latestVersionTag(): string | null {
  try {
    const out = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], {
      encoding: 'utf8',
    });
    return out.split('\n')[0]?.trim() || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest) {
    console.error(
      'usage: release-tools --manifest <path> [--since <ref>] [--paths a,b] [--bump patch|minor|major] [--changelog CHANGELOG.md] [--summarize] [--interactive] [--write]',
    );
    process.exit(2);
  }

  const since = args.since ?? latestVersionTag();
  if (!since) {
    console.error('no --since given and no vX.Y.Z tag found to default to.');
    process.exit(1);
  }

  const manifestText = readFileSync(args.manifest, 'utf8');
  const updater = updaterFor(args.manifest);
  const current = updater.read(manifestText);
  if (!current) {
    console.error(`no version field found in ${args.manifest}`);
    process.exit(1);
  }

  const paths = args.paths ? args.paths.split(',') : [];
  const commits = parseCommits(commitsSince(since, paths));

  if (args.interactive) {
    const result = await interactiveRelease({
      manifestPath: args.manifest,
      current,
      commits,
      today: today(),
      summarise: cliSummariser(),
    });
    if (!result) return;
    writeFileSync(args.manifest, updater.write(manifestText, result.version));
    if (args.changelog) {
      writeFileSync(args.changelog, prepend(readFileSync(args.changelog, 'utf8'), result.entry));
    }
    return;
  }

  // Non-interactive: a manual --bump overrides the commit-derived level.
  let next: string | null;
  if (args.bump) {
    const level = parseLevel(args.bump);
    if (!level) {
      console.error(`--bump must be one of patch, minor, major (got "${args.bump}")`);
      process.exit(2);
    }
    next = applyBump(current, level as BumpLevel);
  } else {
    next = nextVersion(current, commits);
  }

  if (!next) {
    console.log(`No release-worthy commits for ${args.manifest} since ${since}.`);
    return;
  }

  const summary = args.summarize
    ? (cliSummariser()(commits.map((c) => `- ${c.type}: ${c.subject}`).join('\n')) ?? undefined)
    : undefined;
  const entry = renderEntry(next, today(), commits, { summary });

  if (!args.write) {
    console.log(`${current} -> ${next}\n\n${entry}`);
    return;
  }

  writeFileSync(args.manifest, updater.write(manifestText, next));
  if (args.changelog) {
    writeFileSync(args.changelog, prepend(readFileSync(args.changelog, 'utf8'), entry));
  }
  const also = args.changelog ? ` (+ ${args.changelog})` : '';
  console.log(`${args.manifest}: ${current} -> ${next}${also}`);
}

main();
