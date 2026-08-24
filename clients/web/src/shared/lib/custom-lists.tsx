// Custom named lists: user-created collections, synced from the server.

import type { CustomList } from '@kroma/core';
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
  itemInList: (listId: string, itemId: string) => Promise<boolean>;
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
      const inList = entries.includes(itemId);
      if (inList) {
        await client.removeFromCustomList(listId, itemId);
      } else {
        await client.addToCustomList(listId, itemId);
      }
    },
    [client],
  );

  const itemInList = useCallback(
    async (listId: string, itemId: string) => {
      const entries = await client.customListEntries(listId);
      return entries.includes(itemId);
    },
    [client],
  );

  const value = useMemo<CustomListsValue>(
    () => ({
      ready,
      lists,
      refresh: load,
      createList,
      deleteList,
      renameList,
      toggleItem,
      itemInList,
    }),
    [ready, lists, load, createList, deleteList, renameList, toggleItem, itemInList],
  );

  return <CustomListsContext.Provider value={value}>{children}</CustomListsContext.Provider>;
}

export function useCustomLists(): CustomListsValue {
  const ctx = useContext(CustomListsContext);
  if (!ctx) throw new Error('useCustomLists must be used within <CustomListsProvider>');
  return ctx;
}
