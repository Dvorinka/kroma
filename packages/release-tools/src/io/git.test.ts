import { describe, expect, it, vi } from 'vitest';
import { commitsSince } from './git';

describe('commitsSince', () => {
  it('splits the log on the sentinel and trims blanks', () => {
    const exec = vi.fn(
      () => 'feat: a\n\nbody@@RELEASE-TOOLS-COMMIT@@fix: b@@RELEASE-TOOLS-COMMIT@@',
    );
    expect(commitsSince('v1.0.0', [], exec)).toEqual(['feat: a\n\nbody', 'fix: b']);
  });

  it('passes a path filter after --', () => {
    const exec = vi.fn(() => '');
    commitsSince('v1.0.0', ['server', 'clients/web'], exec);
    const args = exec.mock.calls[0][1];
    expect(args).toContain('--');
    expect(args.slice(args.indexOf('--') + 1)).toEqual(['server', 'clients/web']);
  });

  it('omits the -- separator when there are no paths', () => {
    const exec = vi.fn(() => '');
    commitsSince('v1.0.0', [], exec);
    expect(exec.mock.calls[0][1]).not.toContain('--');
  });
});
