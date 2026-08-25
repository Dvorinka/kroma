// Custom lists popup: shows all user lists with checkmarks for the current item.
// A plus row at the bottom expands into an inline input to create a new list.
// Opened via `await CustomListDialog.call({ itemId })`.

import { useT } from '@kroma/ui';
import { Box, color, Dialog, IconButton, Text } from '@kroma/ui/kit';
import { IconCheck, IconPlus } from '@tabler/icons-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { createCallable } from 'react-call';
import { useAuth } from '#web/shared/lib/auth';
import { useCustomLists } from '#web/shared/lib/custom-lists';

const ROW_HOVER = 'rgba(255,255,255,0.06)' as const;
const ROW_RADIUS = 10 as const;

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '11px 14px',
  background: 'transparent',
  border: 0,
  color: 'inherit',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  borderRadius: ROW_RADIUS,
  transition: 'background 160ms ease-out',
};

const CHECK_WELL: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 7,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 160ms ease-out',
};

const INPUT_STYLE: CSSProperties = {
  flex: 1,
  padding: '11px 14px',
  background: color('tint/8'),
  border: `1px solid ${color('borderStrong')}`,
  borderRadius: ROW_RADIUS,
  color: 'inherit',
  font: 'inherit',
  outline: 'none',
  transition: 'border-color 160ms ease-out',
};

const CREATE_ROW_STYLE: CSSProperties = {
  ...ROW_STYLE,
  marginTop: 4,
};

export const CustomListDialog = createCallable<{ itemId: string }, void>(({ call, itemId }) => {
  const t = useT();
  const { client } = useAuth();
  const { lists, createList, toggleItem } = useCustomLists();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const showInput = () => {
    setCreating(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Dialog.Root open title={t('content.customLists')} width="sm" onClose={() => call.end()}>
      <Dialog.Panel>
        <Box gap={2}>
          {lists.length === 0 && !creating ? (
            <Box py={20} px={4}>
              <Text variant="body" color="textMuted" style={{ textAlign: 'center' }}>
                {t('content.createListHint')}
              </Text>
            </Box>
          ) : null}

          {lists.map((list) => {
            const isChecked = checked.has(list.id);
            return (
              <button
                key={list.id}
                type="button"
                onClick={() => void toggle(list.id)}
                style={ROW_STYLE}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = ROW_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    ...CHECK_WELL,
                    background: isChecked ? color('accent') : color('tint/8'),
                  }}
                >
                  {isChecked ? (
                    <IconCheck size={15} color={color('accentInk')} strokeWidth={2.5} />
                  ) : null}
                </span>
                <Box flex={1} minW={0}>
                  <Text
                    variant="body"
                    color={isChecked ? 'text' : 'text'}
                    style={{ fontWeight: isChecked ? 600 : 400 }}
                    lines={1}
                  >
                    {list.name}
                  </Text>
                </Box>
              </button>
            );
          })}

          {creating ? (
            <Box row gap={8} align="center" pt={10} px={2}>
              <input
                ref={inputRef}
                type="text"
                placeholder={t('content.createListPlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create();
                  if (e.key === 'Escape') {
                    setNewName('');
                    setCreating(false);
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = color('accent/50');
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = color('borderStrong');
                }}
                style={INPUT_STYLE}
                disabled={busy}
              />
              <IconButton
                diameter={38}
                glyph={18}
                radius="md"
                variant="primary"
                icon="check"
                label={t('content.createList')}
                onPress={create}
              />
            </Box>
          ) : (
            <button
              type="button"
              onClick={showInput}
              style={CREATE_ROW_STYLE}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = ROW_HOVER;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                style={{
                  ...CHECK_WELL,
                  background: color('accentSoft'),
                  border: `1px dashed ${color('accent/40')}`,
                }}
              >
                <IconPlus size={15} color={color('accent')} strokeWidth={2} />
              </span>
              <Text variant="body" color="accent">
                {t('content.createList')}
              </Text>
            </button>
          )}
        </Box>
      </Dialog.Panel>
    </Dialog.Root>
  );
});
