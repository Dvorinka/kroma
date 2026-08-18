// Parse a Conventional Commit message into the parts a release needs. Pure and
// side-effect free so the whole bump/changelog decision is unit-testable from a
// list of commit messages, no git required.

export interface ParsedCommit {
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
}

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

// Parse many; drop the lines that are not Conventional Commits (merge commits,
// reverts written by hand, anything off-convention) rather than guessing.
export function parseCommits(messages: string[]): ParsedCommit[] {
  const out: ParsedCommit[] = [];
  for (const message of messages) {
    const parsed = parseCommit(message);
    if (parsed) out.push(parsed);
  }
  return out;
}
