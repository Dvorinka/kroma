// Custom named lists: user-created collections, synced from the server.

import type { CustomList, CustomListEntry } from '@kroma/core';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '#web/shared/lib/auth';

interface CustomListsValue {
  ready: boolean;
  lists: readonly CustomList[];
  refresh: () => void;
  createList: (name: string, icon?: string) => Promise<CustomList>;
  deleteList: (id: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  toggleItem: (listId: string, itemId: string) => Promise<void>;
  removeItem: (listId: string, itemId: string) => Promise<void>;
  reorderList: (listId: string, itemIds: string[]) => Promise<void>;
  setEntryNote: (listId: string, itemId: string, note: string) => Promise<void>;
  itemInList: (listId: string, itemId: string) => Promise<boolean>;
  listEntries: (listId: string) => Promise<CustomListEntry[]>;
}

const CustomListsContext = createContext<CustomListsValue | null>(null);

export function CustomListsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { client, user, ready: authReady } = useAuth();
  const [lists, setLists] = useState<readonly CustomList[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    if (!user) {
      setLists([]);
      setReady(true);
      return;
    }
    setReady(false);
    client
      .customLists()
      .then((l) => {
        setLists(l);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [client, user]);

  useEffect(() => {
    if (authReady) load();
  }, [authReady, load]);

  const createList = useCallback(
    async (name: string, icon?: string) => {
      const list = await client.createCustomList(name, icon);
      setLists((prev) => [...prev, list]);
      return list;
    },
    [client],
  );

  const deleteList = useCallback(
    async (id: string) => {
      await client.deleteCustomList(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
    },
    [client],
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      await client.renameCustomList(id, name);
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
    },
    [client],
  );

  const toggleItem = useCallback(
    async (listId: string, itemId: string) => {
      const entries = await client.customListEntries(listId);
      const inList = entries.some((e) => e.item_id === itemId);
      if (inList) {
        await client.removeFromCustomList(listId, itemId);
      } else {
        await client.addToCustomList(listId, itemId);
      }
    },
    [client],
  );

  const removeItem = useCallback(
    async (listId: string, itemId: string) => {
      await client.removeFromCustomList(listId, itemId);
    },
    [client],
  );

  const reorderList = useCallback(
    async (listId: string, itemIds: string[]) => {
      await client.reorderCustomList(listId, itemIds);
    },
    [client],
  );

  const setEntryNote = useCallback(
    async (listId: string, itemId: string, note: string) => {
      await client.setEntryNote(listId, itemId, note);
    },
    [client],
  );

  const itemInList = useCallback(
    async (listId: string, itemId: string) => {
      const entries = await client.customListEntries(listId);
      return entries.some((e) => e.item_id === itemId);
    },
    [client],
  );

  const listEntries = useCallback((listId: string) => client.customListEntries(listId), [client]);

  const value = useMemo<CustomListsValue>(
    () => ({
      ready,
      lists,
      refresh: load,
      createList,
      deleteList,
      renameList,
      toggleItem,
      removeItem,
      reorderList,
      setEntryNote,
      itemInList,
      listEntries,
    }),
    [
      ready,
      lists,
      load,
      createList,
      deleteList,
      renameList,
      toggleItem,
      removeItem,
      reorderList,
      setEntryNote,
      itemInList,
      listEntries,
    ],
  );

  return <CustomListsContext.Provider value={value}>{children}</CustomListsContext.Provider>;
}

export function useCustomLists(): CustomListsValue {
  const ctx = useContext(CustomListsContext);
  if (!ctx) throw new Error('useCustomLists must be used within <CustomListsProvider>');
  return ctx;
}
