import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatBytes,
  formatDuration,
  formatHours,
  formatMbps,
  formatUptime,
  posterGradient,
  relativeSeen,
  timecode,
} from './adminFormat';

describe('posterGradient', () => {
  it('is deterministic and layers a radial + linear gradient', () => {
    const g = posterGradient('Inception');
    expect(g).toBe(posterGradient('Inception'));
    expect(g).toContain('radial-gradient(');
    expect(g).toContain('linear-gradient(155deg');
  });
});

describe('formatDuration', () => {
  it('formats watch time with a zero-padded minutes segment', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min');
    expect(formatDuration((4 * 60 + 29) * 60_000)).toBe('4 h 29 min');
  });
});

describe('formatHours', () => {
  it('renders hours with a locale-aware decimal', () => {
    expect(formatHours(14.3 * 3_600_000, 'fr')).toBe('14,3 h');
    expect(formatHours(0, 'fr')).toBe('0,0 h');
    expect(formatHours(14.3 * 3_600_000, 'en')).toBe('14.3 h');
  });
});

describe('timecode', () => {
  it('drops the hour segment under one hour', () => {
    expect(timecode(0)).toBe('0:00');
    expect(timecode(8 * 60_000 + 30_000)).toBe('8:30');
    expect(timecode((3600 + 42 * 60 + 8) * 1000)).toBe('1:42:08');
  });
});

describe('formatMbps', () => {
  it('one decimal, locale-aware', () => {
    expect(formatMbps(5, 'fr')).toBe('5,0');
    expect(formatMbps(12.34, 'fr')).toBe('12,3');
    expect(formatMbps(Number.NaN, 'fr')).toBe('0,0');
    expect(formatMbps(5, 'en')).toBe('5.0');
  });
});

describe('formatUptime', () => {
  it('scales days / hours / minutes', () => {
    expect(formatUptime(8 * 60, 'fr')).toBe('8 min');
    expect(formatUptime(4 * 3600 + 12 * 60, 'fr')).toBe('4 h 12 min');
    expect(formatUptime(18 * 86400 + 4 * 3600, 'fr')).toBe('18 j 04 h');
    expect(formatUptime(18 * 86400 + 4 * 3600, 'en')).toBe('18 d 04 h');
  });
});

describe('formatBytes (re-exported)', () => {
  it('picks the right unit', () => {
    expect(formatBytes(0, 'fr')).toBe('0 o');
    expect(formatBytes(1536, 'fr')).toBe('2 Ko');
    expect(formatBytes(0, 'en')).toBe('0 B');
    expect(formatBytes(1536, 'en')).toBe('2 KB');
  });
});

describe('relativeSeen', () => {
  afterEach(() => vi.useRealTimers());

  it('handles the null / unparseable cases', () => {
    expect(relativeSeen(null, 'fr')).toBe('jamais');
    expect(relativeSeen(undefined, 'fr')).toBe('jamais');
    expect(relativeSeen('not-a-date', 'fr')).toBe('-');
    expect(relativeSeen(null, 'en')).toBe('never');
  });

  it('renders a French relative label from an ISO timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    expect(relativeSeen('2024-06-15T11:59:30Z', 'fr')).toBe("à l'instant");
    expect(relativeSeen('2024-06-15T11:55:00Z', 'fr')).toBe('il y a 5 min');
    expect(relativeSeen('2024-06-15T09:00:00Z', 'fr')).toBe('il y a 3 h');
    expect(relativeSeen('2024-06-14T11:00:00Z', 'fr')).toBe('hier');
    expect(relativeSeen('2024-06-12T12:00:00Z', 'fr')).toBe('il y a 3 j');
    expect(relativeSeen('2024-05-06T12:00:00Z', 'fr')).toMatch(/\d/);
  });

  it('renders an English relative label from an ISO timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    expect(relativeSeen('2024-06-15T11:59:30Z', 'en')).toBe('just now');
    expect(relativeSeen('2024-06-15T11:55:00Z', 'en')).toBe('5 min ago');
    expect(relativeSeen('2024-06-15T09:00:00Z', 'en')).toBe('3 h ago');
    expect(relativeSeen('2024-06-14T11:00:00Z', 'en')).toBe('yesterday');
    expect(relativeSeen('2024-06-12T12:00:00Z', 'en')).toBe('3 d ago');
  });
});
