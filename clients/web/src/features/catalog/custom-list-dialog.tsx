// Custom lists popup: shows all user lists with checkmarks for the current item,
// and a "create new list" input. Opened via `await CustomListDialog.call({ itemId })`.

import { useT } from '@kroma/ui';
import { Box, Button, Dialog, Text } from '@kroma/ui/kit';
import { IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { createCallable } from 'react-call';
import { useAuth } from '#web/shared/lib/auth';
import { useCustomLists } from '#web/shared/lib/custom-lists';

export const CustomListDialog = createCallable<{ itemId: string }, void>(({ call, itemId }) => {
  const t = useT();
  const { client } = useAuth();
  const { lists, createList, toggleItem } = useCustomLists();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.listsForItem(itemId).then((pairs) => {
      setChecked(new Set(pairs.map((p) => p.id)));
    });
  }, [client, itemId]);

  const toggle = async (listId: string) => {
    const wasChecked = checked.has(listId);
    setChecked((prev) => {
      const next = new Set(prev);
      if (wasChecked) next.delete(listId);
      else next.add(listId);
      return next;
    });
    try {
      await toggleItem(listId, itemId);
    } catch {
      setChecked((prev) => {
        const next = new Set(prev);
        if (wasChecked) next.add(listId);
        else next.delete(listId);
        return next;
      });
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const list = await createList(name);
      await toggleItem(list.id, itemId);
      setChecked((prev) => new Set(prev).add(list.id));
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open title={t('content.customLists')} width="sm" onClose={() => call.end()}>
      <Dialog.Header>
        <Text variant="title">{t('content.customLists')}</Text>
      </Dialog.Header>
      <Dialog.Panel>
        <Box gap={8}>
          {lists.length === 0 ? (
            <Text variant="meta" color="white/50">
              {t('content.createList')}
            </Text>
          ) : null}
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => void toggle(list.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'none',
                border: 0,
                color: 'inherit',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {checked.has(list.id) ? (
                <IconCheck size={18} />
              ) : (
                <span style={{ width: 18, display: 'inline-block' }} />
              )}
              <Text variant="body">{list.name}</Text>
            </button>
          ))}
        </Box>
        <Box row gap={8} mt={16} align="center">
          <input
            type="text"
            placeholder={t('content.createListPlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'inherit',
              font: 'inherit',
            }}
          />
          <Button icon="plus" label={t('content.createList')} onPress={create} loading={busy} />
        </Box>
      </Dialog.Panel>
    </Dialog.Root>
  );
});
