// A small dialog that lets the user pick per-request quality preferences
// (max resolution, max size) before filing a request. Returns the chosen
// values via onConfirm, or null when the user dismisses without choosing.

import { useT } from '@kroma/ui';
import { Box, Button, Dialog, Field, Select, Text } from '@kroma/ui/kit';
import { useState } from 'react';

export interface QualityPref {
  maxResolution: string | null;
  maxSizeGb: number | null;
}

const RESOLUTIONS = ['', '720p', '1080p', '2160p'] as const;
const SIZES = [0, 2, 5, 10, 20, 50] as const;

export function QualityPrefDialog({
  open,
  onClose,
  onConfirm,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onConfirm: (pref: QualityPref) => void;
}>) {
  const t = useT();
  const [resolution, setResolution] = useState('');
  const [sizeGb, setSizeGb] = useState('0');

  const confirm = () => {
    onConfirm({
      maxResolution: resolution || null,
      maxSizeGb: sizeGb === '0' ? null : Number(sizeGb),
    });
  };

  return (
    <Dialog.Root open={open} onClose={onClose} width="sm" title={t('discover.qualityPref')}>
      <Dialog.Header>
        <Text variant="title" accessibilityRole="header">
          {t('discover.qualityPref')}
        </Text>
        <Text variant="meta" color="textDim" mt={4}>
          {t('discover.qualityPrefHint')}
        </Text>
      </Dialog.Header>

      <Dialog.Panel>
        <Box gap={12}>
          <Field.Root label={t('discover.maxResolution')}>
            <Select.Root
              value={resolution}
              onValueChange={setResolution}
              label={t('discover.maxResolution')}
            >
              <Select.Trigger block />
              <Select.Item value="" label={t('discover.qualityDefault')}>
                {t('discover.qualityDefault')}
              </Select.Item>
              {RESOLUTIONS.filter((r) => r).map((r) => (
                <Select.Item
                  key={r}
                  value={r}
                  label={r === '2160p' ? t('discover.quality2160p') : r}
                >
                  {r === '2160p' ? t('discover.quality2160p') : r}
                </Select.Item>
              ))}
            </Select.Root>
          </Field.Root>

          <Field.Root label={t('discover.maxSize')}>
            <Select.Root value={sizeGb} onValueChange={setSizeGb} label={t('discover.maxSize')}>
              <Select.Trigger block />
              <Select.Item value="0" label={t('discover.qualityDefault')}>
                {t('discover.qualityDefault')}
              </Select.Item>
              {SIZES.filter((s) => s > 0).map((s) => (
                <Select.Item key={s} value={String(s)} label={`${s} GB`}>
                  {s} GB
                </Select.Item>
              ))}
            </Select.Root>
          </Field.Root>
        </Box>
      </Dialog.Panel>

      <Dialog.Footer>
        <Dialog.Actions>
          <Button variant="ghost" label={t('common.cancel')} onPress={onClose} />
          <Button variant="primary" label={t('discover.request')} onPress={confirm} />
        </Dialog.Actions>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
