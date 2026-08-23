// Formatting + deterministic-gradient helpers for the admin console. The core
// hue / decimal / formatBytes helpers live in @kroma/core; this module
// re-exports the ones the web app consumes and keeps the web-specific extras
// (poster gradient, locale-aware durations/uptime, relative timestamps) below.

import {
  formatBytes as coreFormatBytes,
  decimal,
  formatTimecode,
  hueFromString,
  type Locale,
} from '@kroma/core';
import { useLocale } from '@kroma/ui';
import { useCallback } from 'react';

export { decimal, formatBytes } from '@kroma/core';

/** Poster gradient for a title (matches the design's `posterGrad`). */
export function posterGradient(title: string): string {
  const h = hueFromString(title);
  return `radial-gradient(120% 90% at 30% 16%, hsla(${(h + 22) % 360},60%,46%,.5), transparent 62%), linear-gradient(155deg, hsl(${h} 42% 27%), hsl(${(h + 30) % 360} 48% 10%))`;
}

/** Watch time from milliseconds: "4 h 29 min" / "65 min" / "0 min". */
export function formatDuration(ms: number, _locale?: Locale): string {
  const totalMin = Math.round((ms || 0) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

/** Hours with one decimal (chart axis labels): "14,3 h". */
export function formatHours(ms: number, locale: Locale = 'en'): string {
  return `${decimal((ms || 0) / 3_600_000, 1, locale)} h`;
}

/** Player timecode from ms: "1:42:08" or "8:30". Core's scrub-bar formatter,
 * fed milliseconds. */
export function timecode(ms: number): string {
  return formatTimecode((ms || 0) / 1000);
}

/** Mb/s with a locale-aware decimal. */
export function formatMbps(n: number, locale: Locale = 'en'): string {
  return decimal(n || 0, 1, locale);
}

/** Uptime "18 d 04 h" / "4 h 12 min" / "8 min" (en) — "18 j 04 h" (fr). */
export function formatUptime(secs: number, locale: Locale = 'en'): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const dayLabel = locale === 'fr' ? 'j' : 'd';
  if (d > 0) return `${d} ${dayLabel} ${String(h).padStart(2, '0')} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

/** "2 h ago" / "yesterday" / "just now" (en) — "il y a 2 h" / "hier" / "à l'instant" (fr). */
export function relativeSeen(iso: string | null | undefined, locale: Locale = 'en'): string {
  if (!iso) return locale === 'fr' ? 'jamais' : 'never';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '-';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return locale === 'fr' ? "à l'instant" : 'just now';
  if (min < 60) return locale === 'fr' ? `il y a ${min} min` : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return locale === 'fr' ? `il y a ${h} h` : `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return locale === 'fr' ? 'hier' : 'yesterday';
  if (d < 30) return locale === 'fr' ? `il y a ${d} j` : `${d} d ago`;
  return new Date(then).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US');
}

/** Hook: all format functions bound to the current UI locale. */
export function useFormat() {
  const locale = useLocale();
  const bytes = useCallback((n: number) => coreFormatBytes(n, locale), [locale]);
  const seen = useCallback((iso: string | null | undefined) => relativeSeen(iso, locale), [locale]);
  const uptime = useCallback((secs: number) => formatUptime(secs, locale), [locale]);
  const duration = useCallback((ms: number) => formatDuration(ms, locale), [locale]);
  const hours = useCallback((ms: number) => formatHours(ms, locale), [locale]);
  const mbps = useCallback((n: number) => formatMbps(n, locale), [locale]);
  return { bytes, seen, uptime, duration, hours, mbps, locale };
}
