import { useT } from '@kroma/ui';
import { Box, color, confirm, IconButton, Row, Select, Text } from '@kroma/ui/kit';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { type CSSProperties, memo, useMemo, useRef, useState } from 'react';
import { TileGrid } from '#web/features/catalog/tile-grid';
import { isAuthed } from '#web/shared/lib/api';
import { useCustomLists } from '#web/shared/lib/custom-lists';
import {
  type DecadeFilter,
  filterByDecade,
  filterByKind,
  type KindFilter,
  type Sort,
  sortEntries,
  useResolvedList,
} from '#web/shared/lib/list-utils';
import { catalogQueries } from '#web/shared/lib/queries';
import { Image, PAGE_MAIN, SkeletonRow } from '#web/shared/ui';

export const Route = createFileRoute('/_app/mylist/list/$id')({
  loader: async ({ context: { queryClient } }) => {
    if (!isAuthed()) return;
    await Promise.all([
      queryClient.ensureQueryData(catalogQueries.moviesView()),
      queryClient.ensureQueryData(catalogQueries.showsView()),
    ]);
  },
  pendingComponent: ListDetailPending,
  component: CustomListDetailPage,
});

function ListDetailPending() {
  return (
    <main className={PAGE_MAIN}>
      <Box mt={24}>
        <SkeletonRow count={6} />
      </Box>
    </main>
  );
}

type ViewMode = 'grid' | 'detail';

const TOOLBAR_PILL: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  background: color('surface2'),
  border: `1px solid ${color('border')}`,
  borderRadius: 10,
};

const DETAIL_ROW: CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
  paddingTop: 16,
  paddingBottom: 16,
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: color('border'),
};

const DETAIL_POSTER: CSSProperties = {
  width: 80,
  height: 120,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
  position: 'relative',
  background: color('surface2'),
};

function navigateToEntry(
  e: { kind: 'movie' | 'show'; localId: string | null; tmdbId: number | null },
  navigate: (opts: { to: string; params: Record<string, string> }) => void,
) {
  if (e.localId) {
    navigate({
      to: e.kind === 'show' ? '/show/$id' : '/movie/$id',
      params: { id: e.localId },
    });
  } else if (e.tmdbId != null) {
    navigate({
      to: '/discover/$type/$tmdbId',
      params: { type: e.kind === 'show' ? 'tv' : 'movie', tmdbId: String(e.tmdbId) },
    });
  }
}

const NOTE_FIELD_STYLE: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: color('tint/6'),
  border: `1px solid ${color('border')}`,
  borderRadius: 8,
  color: 'inherit',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
  resize: 'none',
  minHeight: 36,
  transition: 'border-color 160ms ease-out',
};

const NoteField = memo(function NoteField({
  listId,
  itemId,
  initialNote,
  onSave,
  onSaved,
}: Readonly<{
  listId: string;
  itemId: string;
  initialNote: string | null;
  onSave: (listId: string, itemId: string, note: string) => Promise<void>;
  onSaved: () => void;
}>) {
  const t = useT();
  const [value, setValue] = useState(initialNote ?? '');
  const [dirty, setDirty] = useState(false);

  const save = async () => {
    if (!dirty) return;
    setDirty(false);
    try {
      await onSave(listId, itemId, value.trim());
      onSaved();
    } catch {
      setDirty(true);
    }
  };

  return (
    <textarea
      value={value}
      placeholder={t('content.notePlaceholder')}
      onChange={(e) => {
        setValue(e.target.value);
        setDirty(true);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = color('border');
        void save();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setValue(initialNote ?? '');
          setDirty(false);
          e.currentTarget.blur();
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = color('accent/50');
      }}
      style={NOTE_FIELD_STYLE}
    />
  );
});

function CustomListDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: listId } = Route.useParams();
  const {
    lists: customLists,
    renameList,
    deleteList,
    removeItem,
    reorderList,
    setEntryNote: saveNote,
    listEntries,
  } = useCustomLists();
  const { data: movies } = useSuspenseQuery(catalogQueries.moviesView());
  const { data: shows } = useSuspenseQuery(catalogQueries.showsView());

  const movieById = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies]);
  const showById = useMemo(() => new Map(shows.map((s) => [s.id, s])), [shows]);

  const list = customLists.find((l) => l.id === listId);
  const listName = list?.name ?? '';

  const { data: entries, isLoading } = useQuery({
    queryKey: ['custom-list', 'entries', listId] as const,
    queryFn: () => listEntries(listId),
    staleTime: 10_000,
  });

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(listName);
  const [busy, setBusy] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [customOrder, setCustomOrder] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [sort, setSort] = useState<Sort>('recent');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [decadeFilter, setDecadeFilter] = useState<DecadeFilter>('all');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  const ids = useMemo(() => (entries ?? []).map((e) => e.item_id), [entries]);
  const notesMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of entries ?? []) map.set(e.item_id, e.note);
    return map;
  }, [entries]);
  const positionsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries ?? []) {
      if (e.position != null) map.set(e.item_id, e.position);
    }
    return map;
  }, [entries]);

  const resolved = useResolvedList(ids, !isLoading, movieById, showById, notesMap, positionsMap);

  const orderedEntries = useMemo(() => {
    if (!resolved.ready || resolved.loading) return [];
    if (customOrder) {
      const byKey = new Map(resolved.entries.map((e) => [e.key, e]));
      return manualOrder
        .map((k) => byKey.get(k))
        .filter((e): e is NonNullable<typeof e> => e != null);
    }
    const list = [...resolved.entries];
    if (shuffled) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = list[i];
        const b = list[j];
        if (a && b) {
          list[i] = b;
          list[j] = a;
        }
      }
      return list;
    }
    const byKind = filterByKind(list, kindFilter);
    const byDecade = filterByDecade(byKind, decadeFilter);
    return sortEntries(byDecade, sort);
  }, [resolved, customOrder, manualOrder, shuffled, sort, kindFilter, decadeFilter]);

  const movieCount = resolved.entries.filter((e) => e.kind === 'movie').length;
  const showCount = resolved.entries.filter((e) => e.kind === 'show').length;

  const enterCustomOrder = () => {
    if (!customOrder) {
      setManualOrder(orderedEntries.map((e) => e.key));
    }
    setCustomOrder(true);
    setShuffled(false);
  };

  const exitCustomOrder = async () => {
    setCustomOrder(false);
    if (manualOrder.length > 0) {
      try {
        await reorderList(listId, manualOrder);
        await queryClient.invalidateQueries({ queryKey: ['custom-list', 'entries', listId] });
      } catch {
        // ignore — order stays in local state
      }
    }
  };

  const moveItem = (key: string, dir: -1 | 1) => {
    const index = manualOrder.indexOf(key);
    if (index === -1) return;
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= manualOrder.length) return;
    const next = [...manualOrder];
    const a = next[index];
    const b = next[newIndex];
    if (a && b) {
      next[index] = b;
      next[newIndex] = a;
      setManualOrder(next);
    }
  };

  const doRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === listName) {
      setRenaming(false);
      setName(listName);
      return;
    }
    setBusy(true);
    try {
      await renameList(listId, trimmed);
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    const ok = await confirm({
      title: t('content.deleteList'),
      message: t('content.deleteListConfirm', { name: listName }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    await deleteList(listId);
    void navigate({ to: '/mylist' });
  };

  const doRemove = async (itemId: string) => {
    await removeItem(listId, itemId);
    setManualOrder((prev) => prev.filter((k) => k !== itemId));
    await queryClient.invalidateQueries({ queryKey: ['custom-list', 'entries', listId] });
  };

  if (!list) {
    void navigate({ to: '/mylist' });
    return null;
  }

  return (
    <main className={PAGE_MAIN}>
      <Box mt={24} gap={28}>
        {/* Header */}
        <Box gap={12}>
          <Row gap={12} align="center">
            <IconButton
              diameter={36}
              glyph={18}
              radius="md"
              variant="glass"
              icon="arrow-left"
              label={t('common.back')}
              onPress={() => void navigate({ to: '/mylist' })}
            />
            {!renaming ? (
              <Text variant="h2" style={{ flex: 1 }}>
                {listName}
              </Text>
            ) : null}
            {!renaming ? (
              <Row gap={8} align="center">
                <IconButton
                  diameter={32}
                  glyph={16}
                  radius="sm"
                  variant="glass"
                  icon="edit"
                  label={t('content.renameList')}
                  onPress={() => {
                    setName(listName);
                    setRenaming(true);
                    requestAnimationFrame(() => nameRef.current?.focus());
                  }}
                />
                <IconButton
                  diameter={32}
                  glyph={16}
                  radius="sm"
                  variant="glass"
                  icon="trash"
                  label={t('content.deleteList')}
                  onPress={doDelete}
                />
              </Row>
            ) : null}
          </Row>

          {renaming ? (
            <Row gap={8} align="center">
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void doRename();
                  if (e.key === 'Escape') {
                    setName(listName);
                    setRenaming(false);
                  }
                }}
                style={{
                  padding: '10px 16px',
                  background: color('tint/8'),
                  border: `1px solid ${color('accent/50')}`,
                  borderRadius: 10,
                  color: 'inherit',
                  font: 'inherit',
                  fontSize: 22,
                  fontWeight: 700,
                  outline: 'none',
                  minWidth: 240,
                  flex: 1,
                }}
                disabled={busy}
              />
              <IconButton
                diameter={36}
                glyph={18}
                radius="md"
                variant="primary"
                icon="check"
                label={t('common.save')}
                onPress={doRename}
              />
              <IconButton
                diameter={36}
                glyph={18}
                radius="md"
                variant="glass"
                icon="x"
                label={t('common.cancel')}
                onPress={() => {
                  setName(listName);
                  setRenaming(false);
                }}
              />
            </Row>
          ) : null}

          {resolved.ready && !resolved.loading ? (
            <Text variant="meta" color="textDim">
              {t('content.itemCount', { count: resolved.total })}
              {movieCount > 0 ? ` · ${movieCount} ${t('content.film')}` : ''}
              {showCount > 0 ? ` · ${showCount} ${t('content.series')}` : ''}
            </Text>
          ) : null}
        </Box>

        {/* Toolbar */}
        {resolved.ready && !resolved.loading && resolved.total > 0 ? (
          <Row gap={8} align="center" wrap>
            {!customOrder ? (
              <>
                <div style={TOOLBAR_PILL}>
                  <Select.Root
                    label={t('content.sortRecent')}
                    value={sort}
                    onValueChange={(v) => setSort(v as Sort)}
                  >
                    <Select.Trigger size="sm" />
                    <Select.Item value="recent" label={t('content.sortRecent')} />
                    <Select.Item value="title" label={t('content.sortTitle')} />
                    <Select.Item value="year" label={t('content.sortYear')} />
                    <Select.Item value="rating" label={t('content.sortRating')} />
                  </Select.Root>
                </div>
                <div style={TOOLBAR_PILL}>
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
                </div>
                <div style={TOOLBAR_PILL}>
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
                </div>
                <IconButton
                  diameter={34}
                  glyph={17}
                  radius="md"
                  variant={shuffled ? 'primary' : 'glass'}
                  icon="arrows-shuffle"
                  label={t('content.shuffle')}
                  onPress={() => setShuffled((s) => !s)}
                />
                <IconButton
                  diameter={34}
                  glyph={17}
                  radius="md"
                  variant="glass"
                  icon="arrows-up-down"
                  label={t('content.customOrder')}
                  onPress={enterCustomOrder}
                />
                <Row gap={4} align="center">
                  <IconButton
                    diameter={34}
                    glyph={17}
                    radius="md"
                    variant={viewMode === 'grid' ? 'primary' : 'glass'}
                    icon="layout-grid"
                    label={t('content.gridView')}
                    onPress={() => setViewMode('grid')}
                  />
                  <IconButton
                    diameter={34}
                    glyph={17}
                    radius="md"
                    variant={viewMode === 'detail' ? 'primary' : 'glass'}
                    icon="list"
                    label={t('content.detailedView')}
                    onPress={() => setViewMode('detail')}
                  />
                </Row>
              </>
            ) : (
              <Row gap={10} align="center">
                <Text variant="label" color="textDim">
                  {t('content.customOrder')}
                </Text>
                <IconButton
                  diameter={34}
                  glyph={17}
                  radius="md"
                  variant="primary"
                  icon="check"
                  label={t('common.done')}
                  onPress={() => void exitCustomOrder()}
                />
              </Row>
            )}
          </Row>
        ) : null}

        {/* Empty state */}
        {resolved.ready && !resolved.loading && resolved.total === 0 ? (
          <Box py={48} align="center" gap={12}>
            <Text variant="body" color="textDim" style={{ textAlign: 'center' }}>
              {t('content.customListEmpty')}
            </Text>
          </Box>
        ) : null}

        {/* Grid view */}
        {resolved.ready && !resolved.loading && orderedEntries.length > 0 && viewMode === 'grid' ? (
          <TileGrid>
            {(width) =>
              orderedEntries.map((e) => (
                <div key={e.key} style={{ position: 'relative' }}>
                  {e.render(width)}
                  {customOrder ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <IconButton
                        diameter={26}
                        glyph={13}
                        radius="sm"
                        variant="glass"
                        icon="chevron-up"
                        label={t('content.moveUp')}
                        onPress={() => moveItem(e.key, -1)}
                      />
                      <IconButton
                        diameter={26}
                        glyph={13}
                        radius="sm"
                        variant="glass"
                        icon="chevron-down"
                        label={t('content.moveDown')}
                        onPress={() => moveItem(e.key, 1)}
                      />
                    </div>
                  ) : null}
                  <IconButton
                    diameter={28}
                    glyph={14}
                    radius="sm"
                    variant="danger"
                    icon="x"
                    label={t('content.removeFromList')}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      zIndex: 10,
                    }}
                    onPress={() => void doRemove(e.key)}
                  />
                </div>
              ))
            }
          </TileGrid>
        ) : null}

        {/* Detail view */}
        {resolved.ready &&
        !resolved.loading &&
        orderedEntries.length > 0 &&
        viewMode === 'detail' ? (
          <Box gap={0}>
            {orderedEntries.map((e, i) => (
              <div key={e.key} style={DETAIL_ROW}>
                {/* Number */}
                <Text
                  variant="meta"
                  color="textDim"
                  style={{ width: 28, textAlign: 'right', flexShrink: 0, paddingTop: 2 }}
                >
                  {i + 1}
                </Text>

                {/* Poster thumbnail — clickable */}
                <button
                  type="button"
                  onClick={() => navigateToEntry(e, navigate)}
                  style={{ ...DETAIL_POSTER, cursor: 'pointer', border: 0, padding: 0 }}
                >
                  {e.posterUrl ? <Image src={e.posterUrl} fit="cover" fill /> : null}
                </button>

                {/* Title + metadata + inline note */}
                <Box flex={1} gap={6} minW={0}>
                  <button
                    type="button"
                    onClick={() => navigateToEntry(e, navigate)}
                    style={{
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      color: 'inherit',
                      font: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <Text variant="body" style={{ fontWeight: 600 }} lines={1}>
                      {e.title}
                    </Text>
                  </button>
                  <Row gap={10} align="center">
                    {e.year ? (
                      <Text variant="meta" color="textDim">
                        {e.year}
                      </Text>
                    ) : null}
                    {e.rating ? (
                      <Row gap={3} align="center">
                        <IconButton
                          diameter={16}
                          glyph={10}
                          radius="sm"
                          variant="ghost"
                          icon="star"
                          label=""
                          onPress={() => {}}
                        />
                        <Text variant="meta" color="textDim">
                          {e.rating.toFixed(1)}
                        </Text>
                      </Row>
                    ) : null}
                    <Text variant="meta" color="textDim">
                      {e.kind === 'movie' ? t('content.film') : t('content.series')}
                    </Text>
                  </Row>

                  {/* Inline note — always visible, saves on blur */}
                  <NoteField
                    listId={listId}
                    itemId={e.key}
                    initialNote={e.note}
                    onSave={saveNote}
                    onSaved={() =>
                      void queryClient.invalidateQueries({
                        queryKey: ['custom-list', 'entries', listId],
                      })
                    }
                  />
                </Box>

                {/* Actions */}
                <Box gap={4} style={{ flexShrink: 0 }}>
                  {customOrder ? (
                    <Box gap={2}>
                      <IconButton
                        diameter={26}
                        glyph={13}
                        radius="sm"
                        variant="glass"
                        icon="chevron-up"
                        label={t('content.moveUp')}
                        onPress={() => moveItem(e.key, -1)}
                      />
                      <IconButton
                        diameter={26}
                        glyph={13}
                        radius="sm"
                        variant="glass"
                        icon="chevron-down"
                        label={t('content.moveDown')}
                        onPress={() => moveItem(e.key, 1)}
                      />
                    </Box>
                  ) : null}
                  <IconButton
                    diameter={26}
                    glyph={13}
                    radius="sm"
                    variant="ghost"
                    icon="x"
                    label={t('content.removeFromList')}
                    onPress={() => void doRemove(e.key)}
                  />
                </Box>
              </div>
            ))}
          </Box>
        ) : null}

        {!resolved.ready || resolved.loading ? <SkeletonRow count={6} /> : null}
      </Box>
    </main>
  );
}
