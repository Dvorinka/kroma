#!/usr/bin/env bun
// Thin wiring around the tested modules. The logic lives in conventional.ts /
// bump.ts / changelog.ts / manifests.ts; this file only reads git + files and
// prints or writes. Kept deliberately small so "is the release correct?" is
// answered by unit tests, not by exercising the CLI.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { nextVersion } from './bump';
import { prepend, renderEntry } from './changelog';
import { parseCommits } from './conventional';
import { kindFromPath, readVersion, writeVersion } from './manifests';
import { summarize } from './summarize';

// A sentinel git prints after each commit body. Plain ASCII (no control chars),
// long and specific enough that no real commit body contains it.
const SEP = '@@KROMA-RELEASE-COMMIT@@';

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

function commitsSince(since: string, paths: string | undefined): string[] {
  const argv = ['log', '--no-merges', `--format=%B${SEP}`, `${since}..HEAD`];
  if (paths) argv.push('--', ...paths.split(','));
  const out = execFileSync('git', argv, { encoding: 'utf8' });
  return out
    .split(SEP)
    .map((message) => message.trim())
    .filter((message) => message.length > 0);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.since) {
    console.error(
      'usage: kroma-release --manifest <path> --since <ref> [--paths a,b] [--changelog CHANGELOG.md] [--summarize] [--write]',
    );
    process.exit(2);
  }

  const manifestText = readFileSync(args.manifest, 'utf8');
  const kind = kindFromPath(args.manifest);
  const current = readVersion(kind, manifestText);
  if (!current) {
    console.error(`no version field found in ${args.manifest}`);
    process.exit(1);
  }

  const commits = parseCommits(commitsSince(args.since, args.paths));
  const next = nextVersion(current, commits);
  if (!next) {
    console.log(`No release-worthy commits for ${args.manifest} since ${args.since}.`);
    return;
  }

  const summary = args.summarize
    ? (summarize(commits.map((c) => `- ${c.type}: ${c.subject}`).join('\n')) ?? undefined)
    : undefined;
  const entry = renderEntry(next, today(), commits, summary);

  if (!args.write) {
    console.log(`${current} -> ${next}\n\n${entry}`);
    return;
  }

  writeFileSync(args.manifest, writeVersion(kind, manifestText, next));
  if (args.changelog) {
    const existing = readFileSync(args.changelog, 'utf8');
    writeFileSync(args.changelog, prepend(existing, entry));
  }
  const also = args.changelog ? ` (+ ${args.changelog})` : '';
  console.log(`${args.manifest}: ${current} -> ${next}${also}`);
}

main();
