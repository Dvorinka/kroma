import { createFileRoute } from '@tanstack/react-router';
import { GeneralSettingsPage } from '#web/features/admin/general-settings';

export const Route = createFileRoute('/admin/general')({
  component: GeneralSettingsPage,
});
