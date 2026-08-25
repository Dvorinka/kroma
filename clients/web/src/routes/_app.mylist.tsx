import type { CustomListEntry, MessageKey } from '@kroma/core';
import { useT } from '@kroma/ui';
import { Box, PageHeader, Row, SegmentGroup, Select, Text } from '@kroma/ui/kit';

import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { type CSSProperties, useMemo, useState } from 'react';
import { TileGrid } from '#web/features/catalog/tile-grid';
import { isAuthed } from '#web/shared/lib/api';
import { useCustomLists } from '#web/shared/lib/custom-lists';
import {
  type DecadeFilter,
  filterByDecade,
  filterByKind,
  type KindFilter,
  postersForList,
  type ResolvedList,
  type Sort,
  sortEntries,
  type UnifiedEntry,
  useDiscoverEntries,
  useResolvedList,
} from '#web/shared/lib/list-utils';
import { useMyList } from '#web/shared/lib/mylist';
import { catalogQueries } from '#web/shared/lib/queries';
import { useWatchLater } from '#web/shared/lib/watch-later';
import { useWatched } from '#web/shared/lib/watched';
import { Image, PAGE_MAIN, SkeletonRow } from '#web/shared/ui';

type BuiltinTab = 'mylist' | 'watchlater' | 'watched';

const BUILTIN_TABS: readonly BuiltinTab[] = ['mylist', 'watchlater', 'watched'];

export const Route = createFileRoute('/_app/mylist')({
  loader: async ({ context: { queryClient } }) => {
    if (!isAuthed()) return;
    await Promise.all([
      queryClient.ensureQueryData(catalogQueries.moviesView()),
      queryClient.ensureQueryData(catalogQueries.showsView()),
    ]);
  },
  pendingComponent: MyListPending,
  component: MyListPage,
});

function MyListPending() {
  const t = useT();
  return (
    <main className={PAGE_MAIN}>
      <PageHeader.Root>
        <PageHeader.Title>{t('nav.myList')}</PageHeader.Title>
      </PageHeader.Root>
      <Box mt={24}>
        <SkeletonRow count={10} />
      </Box>
    </main>
  );
}

function UnifiedGrid({ entries }: Readonly<{ entries: UnifiedEntry[] }>) {
  if (entries.length === 0) return null;
  return (
    <TileGrid>{(width) => entries.map((e) => <div key={e.key}>{e.render(width)}</div>)}</TileGrid>
  );
}

function ListContent({
  list,
  emptyKey,
  suppressEmpty,
}: Readonly<{ list: ResolvedList; emptyKey: MessageKey; suppressEmpty?: boolean }>) {
  const t = useT();
  const [sort, setSort] = useState<Sort>('title');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [decadeFilter, setDecadeFilter] = useState<DecadeFilter>('all');

  if (list.ready && !list.loading && list.total === 0) {
    if (suppressEmpty) return null;
    return (
      <Box py={32} align="center" gap={8}>
        <Text variant="body" color="textDim" style={{ textAlign: 'center' }}>
          {t(emptyKey)}
        </Text>
      </Box>
    );
  }
  if (list.total === 0 && !list.ready) return null;

  const byKind = filterByKind(list.entries, kindFilter);
  const byDecade = filterByDecade(byKind, decadeFilter);
  const sorted = sortEntries(byDecade, sort);
  const movieCount = list.entries.filter((e) => e.kind === 'movie').length;
  const showCount = list.entries.filter((e) => e.kind === 'show').length;

  return (
    <Box gap={16}>
      <Row gap={12} align="center" wrap>
        <Select.Root
          label={t('content.filterAll')}
          value={kindFilter}
          onValueChange={(v) => setKindFilter(v as KindFilter)}
        >
          <Select.Trigger size="sm" />
          <Select.Item value="all" label={t('content.filterAll')} />
          <Select.Item value="movie" label={`${t('content.film')} (${movieCount})`} />
          <Select.Item value="show" label={`${t('content.series')} (${showCount})`} />
        </Select.Root>
        <Select.Root
          label={t('content.sortDecade')}
          value={decadeFilter}
          onValueChange={(v) => setDecadeFilter(v as DecadeFilter)}
        >
          <Select.Trigger size="sm" />
          <Select.Item value="all" label={t('content.filterAll')} />
          <Select.Item value="2020s" label="2020s" />
          <Select.Item value="2010s" label="2010s" />
          <Select.Item value="2000s" label="2000s" />
          <Select.Item value="1990s" label="1990s" />
          <Select.Item value="older" label={t('content.sortOlder')} />
        </Select.Root>
        <Select.Root
          label={t('content.sortTitle')}
          value={sort}
          onValueChange={(v) => setSort(v as Sort)}
        >
          <Select.Trigger size="sm" />
          <Select.Item value="title" label={t('content.sortTitle')} />
          <Select.Item value="year" label={t('content.sortYear')} />
          <Select.Item value="rating" label={t('content.sortRating')} />
          <Select.Item value="recent" label={t('content.sortRecent')} />
        </Select.Root>
      </Row>
      <UnifiedGrid entries={sorted} />
    </Box>
  );
}

/** Fetches all custom lists' entries in parallel, for preview thumbnails. */
function useAllCustomListEntries(
  listIds: readonly string[],
  enabled: boolean,
): Map<string, CustomListEntry[]> {
  const { listEntries } = useCustomLists();
  const queries = useQueries({
    queries: listIds.map((id) => ({
      queryKey: ['custom-list', 'entries', id] as const,
      queryFn: () => listEntries(id),
      enabled,
      staleTime: 10_000,
    })),
  });
  return useMemo(() => {
    const map = new Map<string, CustomListEntry[]>();
    for (let i = 0; i < listIds.length; i++) {
      const id = listIds[i];
      if (id) map.set(id, queries[i]?.data ?? []);
    }
    return map;
  }, [listIds, queries]);
}

/** Resolves TMDB poster URLs for every tmdb: ID across all custom lists. */
function useAllTmdbPosters(allEntries: Map<string, CustomListEntry[]>): Map<number, string> {
  const tmdbIds = useMemo(() => {
    const ids = new Set<number>();
    for (const entries of allEntries.values()) {
      for (const e of entries) {
        if (e.item_id.startsWith('tmdb:')) {
          const num = Number(e.item_id.slice(5));
          if (!Number.isNaN(num)) ids.add(num);
        }
      }
    }
    return [...ids];
  }, [allEntries]);
  const { entries } = useDiscoverEntries(tmdbIds);
  return useMemo(() => {
    const map = new Map<number, string>();
    for (const e of entries) {
      if (e.posterUrl) map.set(e.tmdbId, e.posterUrl);
    }
    return map;
  }, [entries]);
}

const CARD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  cursor: 'pointer',
  background: 'transparent',
  border: 0,
  padding: 0,
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
  width: '100%',
  transition: 'transform 200ms ease-out',
};

function CustomListCard({
  name,
  images,
  count,
  onClick,
}: Readonly<{ name: string; images: (string | null)[]; count: number; onClick: () => void }>) {
  const t = useT();
  const posters = images.slice(0, 4);
  while (posters.length < 4) posters.push(null);

  return (
    <button
      type="button"
      onClick={onClick}
      style={CARD_STYLE}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {posters.map((url, i) => (
          <div
            key={url ?? `slot-${i}`}
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'var(--kroma-surface2)',
            }}
          >
            {url ? <Image src={url} fit="cover" fill /> : null}
          </div>
        ))}
      </div>
      <Box row align="center" justify="space-between" px={2}>
        <Text variant="title" lines={1} style={{ fontSize: 15 }}>
          {name}
        </Text>
        <Text variant="meta" color="textDim" shrink={0}>
          {t('content.itemCount', { count })}
        </Text>
      </Box>
    </button>
  );
}

function MyListPage() {
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState<BuiltinTab>('mylist');
  const { data: movies } = useSuspenseQuery(catalogQueries.moviesView());
  const { data: shows } = useSuspenseQuery(catalogQueries.showsView());
  const { ids: myListIds, ready: myListReady } = useMyList();
  const { ids: watchLaterIds, ready: watchLaterReady } = useWatchLater();
  const { ids: watchedIds, ready: watchedReady } = useWatched();
  const { lists: customLists, ready: customListsReady } = useCustomLists();

  const movieById = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies]);
  const showById = useMemo(() => new Map(shows.map((s) => [s.id, s])), [shows]);

  const myList = useResolvedList(myListIds, myListReady, movieById, showById);
  const watchLater = useResolvedList(watchLaterIds, watchLaterReady, movieById, showById);
  const watched = useResolvedList(watchedIds, watchedReady, movieById, showById);

  const customListIds = useMemo(() => customLists.map((l) => l.id), [customLists]);
  const allEntries = useAllCustomListEntries(customListIds, customListsReady);
  const tmdbPosters = useAllTmdbPosters(allEntries);

  // If a child route (/mylist/list/$id) is active, render only the Outlet.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith('/mylist/list/')) return <Outlet />;

  const builtinLists: Record<BuiltinTab, ResolvedList> = {
    mylist: myList,
    watchlater: watchLater,
    watched,
  };

  const active = builtinLists[tab];

  const emptyKeys: Record<string, MessageKey> = {
    mylist: 'content.myListEmpty',
    watchlater: 'content.watchLaterEmpty',
    watched: 'content.watchedEmpty',
  };

  const builtinLabels: Record<BuiltinTab, string> = {
    mylist: t('nav.myList'),
    watchlater: t('discover.watchLater'),
    watched: t('content.watched'),
  };

  return (
    <main className={PAGE_MAIN}>
      <PageHeader.Root>
        <PageHeader.Title>{t('nav.myList')}</PageHeader.Title>
      </PageHeader.Root>

      <Box mt={32} gap={40}>
        <Box gap={16}>
          <SegmentGroup.Root<BuiltinTab> value={tab} onValueChange={setTab} size="sm" stretch>
            {BUILTIN_TABS.map((bt) => (
              <SegmentGroup.Item key={bt} value={bt}>
                <SegmentGroup.Label>{builtinLabels[bt]}</SegmentGroup.Label>
              </SegmentGroup.Item>
            ))}
          </SegmentGroup.Root>

          {active.ready && !active.loading ? (
            <ListContent
              list={active}
              emptyKey={emptyKeys[tab] ?? 'content.myListEmpty'}
              suppressEmpty={tab === 'mylist' && customListsReady && customLists.length > 0}
            />
          ) : null}
        </Box>

        {tab === 'mylist' && customListsReady && customLists.length > 0 ? (
          <Box gap={20}>
            <Box row wrap gap={24}>
              {customLists.map((cl) => {
                const entries = allEntries.get(cl.id) ?? [];
                const ids = entries.map((e) => e.item_id);
                const images = postersForList(ids, movieById, showById, 4, tmdbPosters);
                return (
                  <Box key={cl.id} w={{ base: '100%', md: 220 }} shrink={0}>
                    <CustomListCard
                      name={cl.name}
                      images={images}
                      count={entries.length}
                      onClick={() =>
                        void navigate({ to: '/mylist/list/$id', params: { id: cl.id } })
                      }
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : null}
      </Box>
    </main>
  );
}
