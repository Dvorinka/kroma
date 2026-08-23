import type { ScoredReleaseView } from '@kroma/core';
import { describe, expect, it } from 'vitest';
import {
  filterManualReleases,
  filterReleases,
  sortManualReleases,
  sortReleases,
  targetLabel,
} from './release-sort';
import type { ManualReleaseView } from './schemas';

function release(over: Partial<ScoredReleaseView>): ScoredReleaseView {
  return {
    title: 'R',
    guid: 'g',
    indexerId: 'i' as ScoredReleaseView['indexerId'],
    indexerName: 'Indexer',
    sizeBytes: null,
    seeders: null,
    leechers: null,
    publishedAt: null,
    target: 'movie',
    season: null,
    episodes: null,
    score: 0,
    breakdown: [],
    rejected: null,
    grabbable: true,
    upgrade: false,
    detailsUrl: null,
    ...over,
  };
}

describe('filterReleases', () => {
  const list = [release({ guid: 'a' }), release({ guid: 'b', score: null, rejected: 'too-big' })];

  it('splits on whether the engine accepted the release', () => {
    expect(filterReleases(list, 'accepted').map((r) => r.guid)).toEqual(['a']);
    expect(filterReleases(list, 'rejected').map((r) => r.guid)).toEqual(['b']);
    expect(filterReleases(list, 'all')).toHaveLength(2);
  });

  it('copies rather than reordering the array it was handed', () => {
    expect(filterReleases(list, 'all')).not.toBe(list);
  });
});

describe('sortReleases', () => {
  it('ranks by the chosen column, best first', () => {
    const list = [
      release({ guid: 'low', score: 10, sizeBytes: 900, seeders: 1 }),
      release({ guid: 'high', score: 90, sizeBytes: 100, seeders: 50 }),
    ];
    expect(sortReleases(list, 'score').map((r) => r.guid)).toEqual(['high', 'low']);
    expect(sortReleases(list, 'size').map((r) => r.guid)).toEqual(['low', 'high']);
    expect(sortReleases(list, 'seeders').map((r) => r.guid)).toEqual(['high', 'low']);
  });

  it('sorts by publication date when asked', () => {
    const list = [
      release({ guid: 'old', publishedAt: '2024-01-01T00:00:00Z' }),
      release({ guid: 'new', publishedAt: '2026-01-01T00:00:00Z' }),
    ];
    expect(sortReleases(list, 'date').map((r) => r.guid)).toEqual(['new', 'old']);
  });

  it('keeps rejected releases last whatever the column', () => {
    // They carry no score, so ranking them among the accepted would put an
    // unusable release at the top of a size or seeders sort.
    const list = [
      release({ guid: 'rejected', score: null, sizeBytes: 9000, seeders: 999 }),
      release({ guid: 'ok', score: 5, sizeBytes: 1, seeders: 1 }),
    ];
    for (const sort of ['score', 'size', 'seeders', 'date'] as const) {
      expect(sortReleases(list, sort).map((r) => r.guid)).toEqual(['ok', 'rejected']);
    }
  });

  it('tolerates missing numbers rather than producing NaN order', () => {
    const list = [release({ guid: 'a', sizeBytes: null }), release({ guid: 'b', sizeBytes: 5 })];
    expect(sortReleases(list, 'size').map((r) => r.guid)).toEqual(['b', 'a']);
  });
});

describe('targetLabel', () => {
  it('names what the release would satisfy', () => {
    expect(targetLabel(release({ target: 'movie' }))).toBeNull();
    expect(targetLabel(release({ target: 'season', season: 3 }))).toBe('S03');
    expect(targetLabel(release({ target: 'episode', season: 3, episodes: [7] }))).toBe('S03E07');
  });
});

describe('filterReleases with indexer', () => {
  const list = [
    release({ guid: 'a', indexerId: 'yts' as ScoredReleaseView['indexerId'] }),
    release({ guid: 'b', indexerId: 'tpb' as ScoredReleaseView['indexerId'] }),
  ];

  it('narrows to one indexer when an id is given', () => {
    expect(filterReleases(list, 'all', 'yts').map((r) => r.guid)).toEqual(['a']);
    expect(filterReleases(list, 'all', 'tpb').map((r) => r.guid)).toEqual(['b']);
  });

  it('returns everything when the id is null or omitted', () => {
    expect(filterReleases(list, 'all', null)).toHaveLength(2);
    expect(filterReleases(list, 'all')).toHaveLength(2);
  });
});

function manualRelease(over: Partial<ManualReleaseView>): ManualReleaseView {
  return {
    title: 'R',
    guid: 'g',
    indexerId: 'i',
    indexerName: 'Indexer',
    downloadUrl: null,
    sizeBytes: null,
    seeders: null,
    leechers: null,
    publishedAt: null,
    resolution: null,
    codec: null,
    source: null,
    parsedTitle: 'R',
    year: null,
    season: null,
    episode: null,
    fullSeason: false,
    detailsUrl: null,
    ...over,
  };
}

describe('filterManualReleases', () => {
  const list = [
    manualRelease({ guid: 'a', indexerId: 'yts' }),
    manualRelease({ guid: 'b', indexerId: 'tpb' }),
  ];

  it('narrows to one indexer when an id is given', () => {
    expect(filterManualReleases(list, 'yts').map((r) => r.guid)).toEqual(['a']);
  });

  it('returns everything when the id is null', () => {
    expect(filterManualReleases(list, null)).toHaveLength(2);
    expect(filterManualReleases(list)).toHaveLength(2);
  });
});

describe('sortManualReleases', () => {
  const list = [
    manualRelease({
      guid: 'small',
      sizeBytes: 100,
      seeders: 1,
      publishedAt: '2024-01-01T00:00:00Z',
    }),
    manualRelease({
      guid: 'big',
      sizeBytes: 900,
      seeders: 50,
      publishedAt: '2026-01-01T00:00:00Z',
    }),
  ];

  it('ranks by seeders descending', () => {
    expect(sortManualReleases(list, 'seeders').map((r) => r.guid)).toEqual(['big', 'small']);
  });

  it('ranks by size descending', () => {
    expect(sortManualReleases(list, 'size').map((r) => r.guid)).toEqual(['big', 'small']);
  });

  it('ranks by date descending', () => {
    expect(sortManualReleases(list, 'date').map((r) => r.guid)).toEqual(['big', 'small']);
  });
});
