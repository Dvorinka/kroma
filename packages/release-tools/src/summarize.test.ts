import { describe, expect, it } from 'vitest';
import { summarize } from './summarize';

describe('summarize', () => {
  it('returns the first line of a successful run', () => {
    const out = summarize('some diff', {
      run: () => ({ status: 0, stdout: 'A crisp human summary.\nignored second line' }),
    });
    expect(out).toBe('A crisp human summary.');
  });

  it('falls back to null on a non-zero exit', () => {
    expect(summarize('x', { run: () => ({ status: 1, stdout: 'nope' }) })).toBeNull();
  });

  it('falls back to null on empty output', () => {
    expect(summarize('x', { run: () => ({ status: 0, stdout: '   \n' }) })).toBeNull();
  });

  it('falls back to null when the runner throws (CLI absent)', () => {
    expect(
      summarize('x', {
        run: () => {
          throw new Error('command not found: claude');
        },
      }),
    ).toBeNull();
  });
});
