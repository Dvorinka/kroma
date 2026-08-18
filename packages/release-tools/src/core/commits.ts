import type { ParsedCommit } from './types';

// Parse a Conventional Commit message into the parts a release needs. Generic
// and side-effect free: feed it strings from anywhere (git, a webhook, a test).

// type(scope)!: subject   — scope and the breaking `!` are optional.
const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:[ \t](?<subject>.+)$/;

export function parseCommit(message: string): ParsedCommit | null {
  const header = message.split('\n', 1)[0];
  const match = header.match(HEADER);
  if (!match?.groups) return null;
  const breaking = match.groups.bang === '!' || /^BREAKING CHANGE:/m.test(message);
  return {
    type: match.groups.type,
    scope: match.groups.scope ?? null,
    breaking,
    subject: match.groups.subject.trim(),
  };
}

// Parse many; silently drop the lines that are not Conventional Commits (merge
// commits, hand-written reverts) rather than guessing at their intent.
export function parseCommits(messages: string[]): ParsedCommit[] {
  const out: ParsedCommit[] = [];
  for (const message of messages) {
    const parsed = parseCommit(message);
    if (parsed) out.push(parsed);
  }
  return out;
}
