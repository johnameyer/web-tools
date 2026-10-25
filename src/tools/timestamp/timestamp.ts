export type EpochUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';

export interface ParsedTimestamp {
  date: Date;
  /** Human description of how the input was interpreted */
  detected: string;
}

const MAX_DATE_MS = 8.64e15;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallTimeIn(utcMs: number, timeZone: string): WallTime {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

/** Builds a UTC timestamp from fields; Date.UTC would map years 0-99 to 1900-1999. */
function utcFromFields(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, ms);
  return date.getTime();
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds (positive east of UTC). */
export function offsetMs(utcMs: number, timeZone: string): number {
  const wall = wallTimeIn(utcMs, timeZone);
  const asUtc = utcFromFields(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Converts wall-clock fields in `timeZone` to an instant. Skipped times resolve forward; repeated times resolve to the first. */
function zonedToUtc(naiveUtcMs: number, timeZone: string): number {
  const first = naiveUtcMs - offsetMs(naiveUtcMs, timeZone);
  const second = naiveUtcMs - offsetMs(first, timeZone);
  return second;
}

function epochToMs(text: string): { ms: number; unit: EpochUnit } {
  const value = Number(text);
  const magnitude = Math.abs(value);
  if (magnitude < 1e11) {
    return { ms: value * 1000, unit: 'seconds' };
  }
  if (magnitude < 1e14) {
    return { ms: value, unit: 'milliseconds' };
  }
  if (magnitude < 1e17) {
    return { ms: value / 1000, unit: 'microseconds' };
  }
  return { ms: value / 1e6, unit: 'nanoseconds' };
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

function parseIso(match: RegExpExecArray, timeZone: string): ParsedTimestamp {
  const [ , year, month, day, hour = '0', minute = '0', second = '0', fraction = '', offset ] = match;
  const ms = Number(fraction.slice(0, 3).padEnd(3, '0'));
  const fields = [ Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second) ] as const;
  const naive = utcFromFields(...fields, ms);

  const check = new Date(naive);
  const roundTrips = check.getUTCFullYear() === fields[0] && check.getUTCMonth() + 1 === fields[1] && check.getUTCDate() === fields[2]
    && check.getUTCHours() === fields[3] && check.getUTCMinutes() === fields[4] && check.getUTCSeconds() === fields[5];
  if (!roundTrips) {
    throw new Error('That date or time does not exist');
  }

  if (offset) {
    const upper = offset.toUpperCase();
    let offsetMinutes = 0;
    if (upper !== 'Z') {
      const digits = upper.slice(1).replace(':', '');
      offsetMinutes = (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || 0)) * (upper[0] === '-' ? -1 : 1);
    }
    return { date: new Date(naive - offsetMinutes * 60000), detected: `ISO 8601 with offset ${upper === 'Z' ? 'UTC' : upper}` };
  }
  return { date: new Date(zonedToUtc(naive, timeZone)), detected: `ISO 8601 without offset, read as ${timeZone}` };
}

/** Throws an Error with a user-facing message when the input cannot be understood. */
export function parseTimestamp(input: string, timeZone: string): ParsedTimestamp {
  const text = input.trim();
  if (!text) {
    throw new Error('Enter a timestamp');
  }

  let result: ParsedTimestamp;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const { ms, unit } = epochToMs(text);
    result = { date: new Date(Math.round(ms)), detected: `Unix epoch in ${unit}` };
  } else {
    const iso = ISO_PATTERN.exec(text);
    if (iso) {
      result = parseIso(iso, timeZone);
    } else {
      const parsed = Date.parse(text);
      if (Number.isNaN(parsed)) {
        throw new Error('Could not recognize this as a timestamp');
      }
      result = { date: new Date(parsed), detected: 'Free-form date, read by the browser (may assume local time)' };
    }
  }

  if (Number.isNaN(result.date.getTime()) || Math.abs(result.date.getTime()) > MAX_DATE_MS) {
    throw new Error('That timestamp is outside the supported date range');
  }
  return result;
}

function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, '0');
}

export function formatOffset(utcMs: number, timeZone: string): string {
  const minutes = Math.round(offsetMs(utcMs, timeZone) / 60000);
  const sign = minutes < 0 ? '-' : '+';
  return `${sign}${pad(Math.trunc(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

/** ISO 8601 with milliseconds and the zone's offset; UTC is written with `Z`. */
export function formatIso(date: Date, timeZone: string): string {
  const wall = wallTimeIn(date.getTime(), timeZone);
  const ms = ((date.getTime() % 1000) + 1000) % 1000;
  const offset = formatOffset(date.getTime(), timeZone);
  const base = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}.${pad(ms, 3)}`;
  return offset === '+00:00' && timeZone === 'UTC' ? `${base}Z` : `${base}${offset}`;
}

export function formatHuman(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'long', timeZone }).format(date);
}

const RELATIVE_UNITS: [ Intl.RelativeTimeFormatUnit, number ][] = [
  [ 'year', 365 * 24 * 3600 ],
  [ 'month', 30 * 24 * 3600 ],
  [ 'week', 7 * 24 * 3600 ],
  [ 'day', 24 * 3600 ],
  [ 'hour', 3600 ],
  [ 'minute', 60 ],
];

export function formatRelative(date: Date, now: Date): string {
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  for (const [ unit, size ] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(Math.trunc(seconds / size), unit);
    }
  }
  return formatter.format(seconds, 'second');
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function listTimeZones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone').filter(zone => zone !== 'UTC');
  return [ 'UTC', ...zones ];
}

export interface OutputRow {
  label: string;
  value: string;
}

export function buildOutputs(date: Date, timeZone: string, now: Date): OutputRow[] {
  const ms = date.getTime();
  const rows: OutputRow[] = [
    { label: 'ISO 8601 (UTC)', value: date.toISOString() },
  ];
  if (timeZone !== 'UTC') {
    rows.push({ label: `ISO 8601 (${timeZone})`, value: formatIso(date, timeZone) });
  }
  rows.push(
    { label: 'Human readable', value: formatHuman(date, timeZone) },
    { label: 'Relative', value: formatRelative(date, now) },
    { label: 'Unix seconds', value: String(Math.floor(ms / 1000)) },
    { label: 'Unix milliseconds', value: String(ms) },
    { label: 'HTTP date (RFC 7231)', value: date.toUTCString() },
  );
  return rows;
}
