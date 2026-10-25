import { describe, expect, it } from 'vitest';

import { buildOutputs, formatIso, formatOffset, formatRelative, listTimeZones, parseTimestamp } from './timestamp';

const NOV_14_2023 = '2023-11-14T22:13:20.000Z';

describe('parseTimestamp epoch input', () => {
  it('reads 10 digits as seconds', () => {
    const { date, detected } = parseTimestamp('1700000000', 'UTC');
    expect(date.toISOString()).toBe(NOV_14_2023);
    expect(detected).toContain('seconds');
  });

  it('reads 13 digits as milliseconds', () => {
    const { date, detected } = parseTimestamp('1700000000000', 'UTC');
    expect(date.toISOString()).toBe(NOV_14_2023);
    expect(detected).toContain('milliseconds');
  });

  it('reads 16 digits as microseconds', () => {
    expect(parseTimestamp('1700000000000000', 'UTC').date.toISOString()).toBe(NOV_14_2023);
  });

  it('reads 19 digits as nanoseconds', () => {
    expect(parseTimestamp('1700000000000000000', 'UTC').date.toISOString()).toBe(NOV_14_2023);
  });

  it('keeps fractional seconds', () => {
    expect(parseTimestamp('1700000000.123', 'UTC').date.toISOString()).toBe('2023-11-14T22:13:20.123Z');
  });

  it('handles zero and negative epochs', () => {
    expect(parseTimestamp('0', 'UTC').date.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(parseTimestamp('-86400', 'UTC').date.toISOString()).toBe('1969-12-31T00:00:00.000Z');
  });
});

describe('parseTimestamp date strings', () => {
  it('honors Z and numeric offsets', () => {
    expect(parseTimestamp('2023-11-14T22:13:20Z', 'Asia/Tokyo').date.toISOString()).toBe(NOV_14_2023);
    expect(parseTimestamp('2023-11-15T03:43:20+05:30', 'UTC').date.toISOString()).toBe(NOV_14_2023);
    expect(parseTimestamp('2023-11-14T17:13:20-0500', 'UTC').date.toISOString()).toBe(NOV_14_2023);
  });

  it('reads input without an offset in the chosen zone', () => {
    expect(parseTimestamp('2024-01-15 12:00', 'America/New_York').date.toISOString()).toBe('2024-01-15T17:00:00.000Z');
    expect(parseTimestamp('2024-07-15 12:00', 'America/New_York').date.toISOString()).toBe('2024-07-15T16:00:00.000Z');
    expect(parseTimestamp('2024-07-15T12:00:00', 'UTC').date.toISOString()).toBe('2024-07-15T12:00:00.000Z');
  });

  it('treats a bare date as midnight in the chosen zone', () => {
    expect(parseTimestamp('2024-03-01', 'Asia/Kolkata').date.toISOString()).toBe('2024-02-29T18:30:00.000Z');
  });

  it('keeps milliseconds from fractional seconds', () => {
    expect(parseTimestamp('2024-01-01T00:00:00.5Z', 'UTC').date.getTime() % 1000).toBe(500);
  });

  it('resolves DST transitions without throwing', () => {
    // 02:30 does not exist on 2024-03-10 in New York; 01:30 on 2024-11-03 happens twice
    expect(() => parseTimestamp('2024-03-10 02:30', 'America/New_York')).not.toThrow();
    expect(() => parseTimestamp('2024-11-03 01:30', 'America/New_York')).not.toThrow();
  });

  it('falls back to browser parsing for other formats', () => {
    expect(parseTimestamp('Tue, 14 Nov 2023 22:13:20 GMT', 'UTC').date.toISOString()).toBe(NOV_14_2023);
  });

  it('rejects impossible dates', () => {
    expect(() => parseTimestamp('2024-02-30', 'UTC')).toThrow('does not exist');
    expect(() => parseTimestamp('2024-13-01', 'UTC')).toThrow('does not exist');
    expect(() => parseTimestamp('2024-01-01 25:00', 'UTC')).toThrow('does not exist');
  });

  it('rejects garbage and empty input', () => {
    expect(() => parseTimestamp('banana', 'UTC')).toThrow('Could not recognize');
    expect(() => parseTimestamp('   ', 'UTC')).toThrow('Enter a timestamp');
  });

  it('rejects out-of-range epochs', () => {
    expect(() => parseTimestamp('99999999999999999999999', 'UTC')).toThrow('outside the supported');
  });
});

describe('formatting', () => {
  const date = new Date(NOV_14_2023);

  it('formats ISO with the zone offset', () => {
    expect(formatIso(date, 'UTC')).toBe('2023-11-14T22:13:20.000Z');
    expect(formatIso(date, 'Asia/Kolkata')).toBe('2023-11-15T03:43:20.000+05:30');
    expect(formatIso(date, 'America/New_York')).toBe('2023-11-14T17:13:20.000-05:00');
  });

  it('formats offsets', () => {
    expect(formatOffset(date.getTime(), 'Asia/Kolkata')).toBe('+05:30');
    expect(formatOffset(date.getTime(), 'America/New_York')).toBe('-05:00');
    expect(formatOffset(date.getTime(), 'UTC')).toBe('+00:00');
  });

  it('formats relative times in both directions', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    expect(formatRelative(new Date('2023-12-31T21:00:00Z'), now)).toBe('3 hours ago');
    expect(formatRelative(new Date('2024-01-03T00:00:00Z'), now)).toBe('in 2 days');
    expect(formatRelative(now, now)).toBe('now');
  });

  it('builds the output list, omitting the zoned ISO row for UTC', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const labels = (zone: string) => buildOutputs(date, zone, now).map(row => row.label);
    expect(labels('UTC').filter(label => label.startsWith('ISO 8601'))).toEqual([ 'ISO 8601 (UTC)' ]);
    expect(labels('UTC')).toHaveLength(6);
    expect(labels('Asia/Kolkata')).toHaveLength(7);
    expect(labels('Asia/Kolkata')).toContain('ISO 8601 (Asia/Kolkata)');
    expect(buildOutputs(date, 'UTC', now).find(row => row.label === 'Unix seconds')?.value).toBe('1700000000');
  });
});

describe('listTimeZones', () => {
  it('starts with UTC and includes major zones once', () => {
    const zones = listTimeZones();
    expect(zones[0]).toBe('UTC');
    expect(zones).toContain('America/New_York');
    expect(zones.filter(zone => zone === 'UTC')).toHaveLength(1);
  });
});
