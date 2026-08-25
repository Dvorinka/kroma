import { type DiscoverDetail, type DiscoverEntry, ItemId, ShowId } from '@kroma/core';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type CatalogEntry, MoviePoster, ShowPoster } from '#web/features/catalog/cards';
import { DiscoverCard } from '#web/features/requests/discover-card';
import { kromaClient, type MovieView, type ShowView } from '#web/shared/lib/api';

export type Sort = 'title' | 'year' | 'rating' | 'recent';
export type KindFilter = 'all' | 'movie' | 'show';
export type DecadeFilter = 'all' | '2020s' | '2010s' | '2000s' | '1990s' | 'older';

export interface UnifiedEntry {
  key: string;
  kind: 'movie' | 'show';
  title: string;
  year: number | null;
  rating: number | null;
  addedAt: string | null;
  posterUrl: string | null;
  note: string | null;
  localId: string | null;
  tmdbId: number | null;
  order: number | null;
  render: (width: number) => React.ReactNode;
}

export interface ResolvedList {
  entries: UnifiedEntry[];
  loading: boolean;
  total: number;
  ready: boolean;
}

export function splitIds(ids: readonly string[]): { local: string[]; tmdb: number[] } {
  const local: string[] = [];
  const tmdb: number[] = [];
  for (const id of ids) {
    if (id.startsWith('tmdb:')) {
      const num = Number(id.slice(5));
      if (!Number.isNaN(num)) tmdb.push(num);
    } else {
      local.push(id);
    }
  }
  return { local, tmdb };
}

async function fetchDiscoverEntry(id: number): Promise<DiscoverEntry> {
  const client = kromaClient();
  try {
    return discoverEntryFromDetail(await client.discoverDetail('movie', id));
  } catch {
    return discoverEntryFromDetail(await client.discoverDetail('tv', id));
  }
}

function discoverEntryFromDetail(d: DiscoverDetail): DiscoverEntry {
  return {
    kind: d.kind,
    tmdbId: d.tmdbId,
    title: d.title,
    year: d.year,
    posterUrl: d.posterUrl,
    backdropUrl: d.backdropUrl,
    overview: d.overview,
    rating: d.rating,
    inLibrary: d.inLibrary,
    localId: d.localId,
    requestId: d.requestId,
    requestStatus: d.requestStatus,
    requestProgress: d.requestProgress,
  };
}

export function useDiscoverEntries(ids: number[]): { entries: DiscoverEntry[]; loading: boolean } {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['discover', 'entry', id] as const,
      queryFn: () => fetchDiscoverEntry(id),
      retry: 1,
    })),
  });
  const entries: DiscoverEntry[] = [];
  let loading = false;
  for (const q of queries) {
    if (q.isLoading) {
      loading = true;
      continue;
    }
    if (q.data) entries.push(q.data);
  }
  return { entries, loading };
}

function toUnifiedLocal(entries: CatalogEntry[]): UnifiedEntry[] {
  return entries.map((e) => {
    if (e.kind === 'movie') {
      return {
        key: e.movie.id,
        kind: 'movie' as const,
        title: e.movie.title,
        year: e.movie.year ?? null,
        rating: e.movie.metadata?.rating ?? null,
        addedAt: e.movie.addedAt ?? null,
        posterUrl: e.movie.poster,
        note: null,
        localId: e.movie.id,
        tmdbId: null,
        order: null,
        render: (width: number) => <MoviePoster item={e.movie} width={width} />,
      };
    }
    return {
      key: e.show.id,
      kind: 'show' as const,
      title: e.show.title,
      year: e.show.year ?? null,
      rating: e.show.metadata?.rating ?? null,
      addedAt: e.show.addedAt ?? null,
      posterUrl: e.show.poster,
      note: null,
      localId: e.show.id,
      tmdbId: null,
      order: null,
      render: (width: number) => <ShowPoster show={e.show} width={width} />,
    };
  });
}

function toUnifiedDiscover(entries: DiscoverEntry[]): UnifiedEntry[] {
  return entries.map((e) => ({
    key: `tmdb:${e.tmdbId}`,
    kind: e.kind,
    title: e.title,
    year: e.year,
    rating: e.rating,
    addedAt: null,
    posterUrl: e.posterUrl,
    note: null,
    localId: e.localId ?? null,
    tmdbId: e.tmdbId,
    order: null,
    render: (width: number) => <DiscoverCard entry={e} width={width} />,
  }));
}

export function sortEntries(entries: UnifiedEntry[], sort: Sort): UnifiedEntry[] {
  const sorted = [...entries];
  if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'year') sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  else if (sort === 'rating') sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else if (sort === 'recent') {
    const hasOrder = sorted.some((e) => e.order != null);
    if (hasOrder) sorted.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    else sorted.sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
  }
  return sorted;
}

export function filterByKind(entries: UnifiedEntry[], filter: KindFilter): UnifiedEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((e) => e.kind === filter);
}

export function filterByDecade(entries: UnifiedEntry[], decade: DecadeFilter): UnifiedEntry[] {
  if (decade === 'all') return entries;
  return entries.filter((e) => {
    const y = e.year;
    if (y == null) return false;
    if (decade === '2020s') return y >= 2020;
    if (decade === '2010s') return y >= 2010 && y < 2020;
    if (decade === '2000s') return y >= 2000 && y < 2010;
    if (decade === '1990s') return y >= 1990 && y < 2000;
    if (decade === 'older') return y < 1990;
    return true;
  });
}

export function useResolvedList(
  ids: readonly string[],
  ready: boolean,
  movieById: Map<string, MovieView>,
  showById: Map<string, ShowView>,
  notesMap?: Map<string, string | null>,
  positionsMap?: Map<string, number>,
): ResolvedList {
  const split = useMemo(() => splitIds(ids), [ids]);
  const { entries: discoverEntries, loading } = useDiscoverEntries(split.tmdb);

  const discoverByKey = useMemo(() => {
    const map = new Map<string, DiscoverEntry>();
    for (const e of discoverEntries) map.set(`tmdb:${e.tmdbId}`, e);
    return map;
  }, [discoverEntries]);

  const unified = useMemo(() => {
    const result: UnifiedEntry[] = [];
    for (const id of ids) {
      if (id.startsWith('tmdb:')) {
        const entry = discoverByKey.get(id);
        if (entry) {
          result.push(toUnifiedDiscover([entry])[0]!);
          continue;
        }
        const num = Number(id.slice(5));
        if (!Number.isNaN(num)) {
          result.push({
            key: id,
            kind: 'movie',
            title: '',
            year: null,
            rating: null,
            addedAt: null,
            posterUrl: null,
            note: null,
            localId: null,
            tmdbId: num,
            order: null,
            render: () => null,
          });
        }
        continue;
      }
      const movie = movieById.get(ItemId.of(id));
      if (movie) {
        result.push(toUnifiedLocal([{ kind: 'movie', movie }])[0]!);
        continue;
      }
      const show = showById.get(ShowId.of(id));
      if (show) {
        result.push(toUnifiedLocal([{ kind: 'show', show }])[0]!);
      }
    }
    if (notesMap) {
      for (const entry of result) {
        const note = notesMap.get(entry.key);
        if (note != null) entry.note = note;
      }
    }
    if (positionsMap) {
      for (const entry of result) {
        const pos = positionsMap.get(entry.key);
        if (pos != null) entry.order = pos;
      }
    }
    return result;
  }, [ids, discoverByKey, movieById, showById, notesMap, positionsMap]);

  return { entries: unified, loading, total: unified.length, ready };
}

export function postersForList(
  ids: readonly string[],
  movieById: Map<string, MovieView>,
  showById: Map<string, ShowView>,
  max: number,
  tmdbPosters?: Map<number, string>,
): string[] {
  const urls: string[] = [];
  for (const id of ids) {
    if (urls.length >= max) break;
    if (id.startsWith('tmdb:')) {
      const num = Number(id.slice(5));
      const poster = tmdbPosters?.get(num);
      if (poster) urls.push(poster);
      continue;
    }
    const movie = movieById.get(ItemId.of(id));
    if (movie) {
      urls.push(movie.poster ?? movie.backdrop);
      continue;
    }
    const show = showById.get(ShowId.of(id));
    if (show) urls.push(show.poster ?? show.backdrop);
  }
  return urls;
}

export function backdropsForList(
  ids: readonly string[],
  movieById: Map<string, MovieView>,
  showById: Map<string, ShowView>,
  max: number,
): string[] {
  const urls: string[] = [];
  for (const id of ids) {
    if (urls.length >= max) break;
    const movie = movieById.get(ItemId.of(id));
    if (movie) {
      urls.push(movie.backdrop ?? movie.poster);
      continue;
    }
    const show = showById.get(ShowId.of(id));
    if (show) urls.push(show.backdrop ?? show.poster);
  }
  return urls;
}
