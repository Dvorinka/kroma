#!/usr/bin/env bun
// The reference consumer: it wires git + files + the default config into the
// library. All release logic lives in the tested core/manifests/io modules; this
// file only parses argv, reads/writes files, and prints.

import { readFileSync, writeFileSync } from 'node:fs';
import { prepend, renderEntry } from './core/changelog';
import { parseCommits } from './core/commits';
import { nextVersion } from './core/semver';
import { commitsSince } from './io/git';
import { cliSummariser } from './io/summarize';
import { updaterFor } from './manifests';

interface Args {
  manifest?: string;
  changelog?: string;
  since?: string;
  paths?: string;
  write?: boolean;
  summarize?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--write') args.write = true;
    else if (key === '--summarize') args.summarize = true;
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
    }
  }
  return args;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.since) {
    console.error(
      'usage: release-tools --manifest <path> --since <ref> [--paths a,b] [--changelog CHANGELOG.md] [--summarize] [--write]',
    );
    process.exit(2);
  }

  const manifestText = readFileSync(args.manifest, 'utf8');
  const updater = updaterFor(args.manifest);
  const current = updater.read(manifestText);
  if (!current) {
    console.error(`no version field found in ${args.manifest}`);
    process.exit(1);
  }

  const paths = args.paths ? args.paths.split(',') : [];
  const commits = parseCommits(commitsSince(args.since, paths));
  const next = nextVersion(current, commits);
  if (!next) {
    console.log(`No release-worthy commits for ${args.manifest} since ${args.since}.`);
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
    const existing = readFileSync(args.changelog, 'utf8');
    writeFileSync(args.changelog, prepend(existing, entry));
  }
  const also = args.changelog ? ` (+ ${args.changelog})` : '';
  console.log(`${args.manifest}: ${current} -> ${next}${also}`);
}

main();
