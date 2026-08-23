// General settings: a client-side UI language card above the server-driven
// admin schema (identity, preferences). The language switcher lives here
// because this is the page a user opens to "change how the server looks" —
// burying it under /account → Preferences made it undiscoverable.

import { LOCALES } from '@kroma/core';
import { useLocale, useSetLocale, useT } from '@kroma/ui';
import { Box, IconWell, ListRow, PageHeader, Select, Surface } from '@kroma/ui/kit';
import { SettingsPage } from '#web/features/admin/settings';

export function GeneralSettingsPage() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <Box gap={24}>
      <PageHeader.Root>
        <PageHeader.Title>{t('admin.pageGeneral')}</PageHeader.Title>
        <PageHeader.Subtitle>{t('admin.pageGeneralSub')}</PageHeader.Subtitle>
      </PageHeader.Root>

      <Box gap={22}>
        <Surface pad="none" overflow="hidden">
          <ListRow.Group size="md">
            <ListRow.Root size="md">
              <ListRow.Leading>
                <IconWell name="language" size="sm" tone="accent" />
              </ListRow.Leading>
              <ListRow.Label>{t('account.uiLanguage')}</ListRow.Label>
              <ListRow.Hint>{t('account.uiLanguageDesc')}</ListRow.Hint>
              <ListRow.Trailing>
                <Select.Root
                  label={t('account.uiLanguage')}
                  value={locale}
                  onValueChange={(v) => setLocale(v as (typeof LOCALES)[number]['code'])}
                >
                  <Select.Trigger />
                  {LOCALES.map((l) => (
                    <Select.Item key={l.code} value={l.code} label={t(l.labelKey)} />
                  ))}
                </Select.Root>
              </ListRow.Trailing>
            </ListRow.Root>
          </ListRow.Group>
        </Surface>

        <SettingsPage
          view="general"
          titleKey="admin.pageGeneral"
          subtitleKey="admin.pageGeneralSub"
          embedded
        />
      </Box>
    </Box>
  );
}
