import { utcFromFields, wallTimeIn, zonedToUtc } from '../timestamp/timestamp';

export interface CronSchedule {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  /** 0-6 with Sunday as 0; a written 7 is folded into 0 */
  daysOfWeek: number[];
  /**
   * Whether the day-of-month / day-of-week field was written starting with `*` (or `?`).
   * Classic cron combines the two day fields with OR unless one of them is starred, in which case both must match.
   */
  domStarred: boolean;
  dowStarred: boolean;
}

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: string[];
  /** Value of the first name, e.g. 1 for JAN */
  nameBase?: number;
}

const MONTH_NAMES = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];
const WEEKDAY_NAMES = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ];

const SPECS: Record<'minute' | 'hour' | 'dom' | 'month' | 'dow', FieldSpec> = {
  minute: { name: 'Minute', min: 0, max: 59 },
  hour: { name: 'Hour', min: 0, max: 23 },
  dom: { name: 'Day of month', min: 1, max: 31 },
  month: { name: 'Month', min: 1, max: 12, names: MONTH_NAMES, nameBase: 1 },
  dow: { name: 'Day of week', min: 0, max: 7, names: WEEKDAY_NAMES, nameBase: 0 },
};

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

function parseValue(token: string, spec: FieldSpec): number {
  if (/^\d+$/.test(token)) {
    return Number(token);
  }
  if (spec.names) {
    const index = spec.names.findIndex(name => name.slice(0, 3).toUpperCase() === token.toUpperCase());
    if (index >= 0 && token.length === 3) {
      return index + (spec.nameBase ?? 0);
    }
  }
  throw new Error(`${spec.name}: "${token}" is not a valid value`);
}

function parseField(text: string, spec: FieldSpec, allowQuestionMark: boolean): { values: number[]; starred: boolean } {
  const values = new Set<number>();
  for (const part of text.split(',')) {
    if (part === '') {
      throw new Error(`${spec.name}: empty entry in "${text}"`);
    }
    const pieces = part.split('/');
    if (pieces.length > 2) {
      throw new Error(`${spec.name}: "${part}" has more than one step`);
    }
    const [ rangeText, stepText ] = pieces;
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) < 1) {
        throw new Error(`${spec.name}: step "${stepText}" must be a whole number of at least 1`);
      }
      step = Number(stepText);
    }

    let start: number;
    let end: number;
    if (rangeText === '*' || (rangeText === '?' && allowQuestionMark)) {
      [ start, end ] = [ spec.min, spec.max ];
    } else {
      const bounds = rangeText.split('-');
      if (bounds.length > 2 || bounds.some(bound => bound === '')) {
        throw new Error(`${spec.name}: "${rangeText}" is not a valid value or range`);
      }
      start = parseValue(bounds[0], spec);
      // A bare value with a step ("5/15") runs from that value to the end of the field
      end = bounds.length === 2 ? parseValue(bounds[1], spec) : stepText !== undefined ? spec.max : start;
      for (const value of [ start, end ]) {
        if (value < spec.min || value > spec.max) {
          throw new Error(`${spec.name}: ${value} is out of range (${spec.min}-${spec.max})`);
        }
      }
      if (start > end) {
        throw new Error(`${spec.name}: range "${rangeText}" runs backwards`);
      }
    }
    for (let value = start; value <= end; value += step) {
      values.add(value);
    }
  }
  return { values: [ ...values ].sort((a, b) => a - b), starred: text.startsWith('*') || text.startsWith('?') };
}

/** Parses a standard 5-field crontab expression or an `@daily`-style macro. Throws a user-facing Error. */
export function parseCron(input: string): CronSchedule {
  let text = input.trim().replace(/\s+/g, ' ');
  if (!text) {
    throw new Error('Enter a cron expression');
  }
  if (text.startsWith('@')) {
    const expanded = MACROS[text.toLowerCase()];
    if (!expanded) {
      throw new Error(text.toLowerCase() === '@reboot' ? '@reboot runs at startup, so it has no schedule to explain' : `Unknown macro ${text}`);
    }
    text = expanded;
  }

  const fields = text.split(' ');
  if (fields.length !== 5) {
    throw new Error(
      fields.length === 6 || fields.length === 7
        ? `This has ${fields.length} fields. This tool handles the standard 5-field format (minute hour day-of-month month day-of-week), without seconds or a year`
        : `Expected 5 fields (minute hour day-of-month month day-of-week) but found ${fields.length}`,
    );
  }

  const minute = parseField(fields[0], SPECS.minute, false);
  const hour = parseField(fields[1], SPECS.hour, false);
  const dom = parseField(fields[2], SPECS.dom, true);
  const month = parseField(fields[3], SPECS.month, false);
  const dow = parseField(fields[4], SPECS.dow, true);

  return {
    minutes: minute.values,
    hours: hour.values,
    daysOfMonth: dom.values,
    months: month.values,
    daysOfWeek: [ ...new Set(dow.values.map(value => value % 7)) ].sort((a, b) => a - b),
    domStarred: dom.starred,
    dowStarred: dow.starred,
  };
}

// ---------------------------------------------------------------------------------------------
// Describing a schedule in English
// ---------------------------------------------------------------------------------------------

const pad2 = (value: number): string => String(value).padStart(2, '0');

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${n}th`;
  }
  return `${n}${[ 'th', 'st', 'nd', 'rd' ][n % 10 <= 3 ? n % 10 : 0]}`;
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function isFull(values: number[], min: number, max: number): boolean {
  return values.length === max - min + 1;
}

/** Detects every-n lists such as 0,15,30,45: min, min+n, min+2n, ... up to the end of the field. Returns n, or undefined. */
function stepFrom(values: number[], min: number, max: number): number | undefined {
  if (values.length < 2 || values[0] !== min) {
    return undefined;
  }
  const step = values[1] - values[0];
  if (step < 2) {
    return undefined;
  }
  const regular = values.every((value, index) => value === min + index * step);
  return regular && values[values.length - 1] + step > max ? step : undefined;
}

function isRun(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value === values[index - 1] + 1);
}

/** Lists values, collapsing runs of three or more into "a through b". */
function describeValues(values: number[], format: (value: number) => string = String): string {
  const items: string[] = [];
  for (let i = 0; i < values.length;) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[j] + 1) {
      j++;
    }
    if (j - i >= 2) {
      items.push(`${format(values[i])} through ${format(values[j])}`);
    } else {
      for (let k = i; k <= j; k++) {
        items.push(format(values[k]));
      }
    }
    i = j + 1;
  }
  return joinList(items);
}

function describeTime(minutes: number[], hours: number[]): string {
  const allMinutes = isFull(minutes, 0, 59);
  const minuteStep = stepFrom(minutes, 0, 59);
  const allHours = isFull(hours, 0, 23);
  const hourStep = stepFrom(hours, 0, 23);
  const singleMinute = minutes.length === 1;

  if (singleMinute && hours.length === 1) {
    return `At ${pad2(hours[0])}:${pad2(minutes[0])}`;
  }

  // A handful of specific times reads best spelled out
  if (!allMinutes && !allHours && !hourStep && minutes.length * hours.length <= 6) {
    return `At ${joinList(hours.flatMap(hour => minutes.map(minute => `${pad2(hour)}:${pad2(minute)}`)))}`;
  }

  // "Every minute", "Every 15 minutes", "At minute 5", "At minutes 0 and 30"
  let base: string;
  let perHour: string;
  if (allMinutes) {
    base = 'Every minute';
    perHour = base;
  } else if (minuteStep) {
    base = `Every ${minuteStep} minutes`;
    perHour = base;
  } else if (singleMinute) {
    base = `At minute ${minutes[0]}`;
    perHour = minutes[0] === 0 ? 'Every hour' : `${base} past every hour`;
  } else {
    base = `At minutes ${describeValues(minutes)}`;
    perHour = `${base} past every hour`;
  }

  if (allHours) {
    return perHour;
  }
  if (hourStep) {
    if (singleMinute && minutes[0] === 0) {
      return `Every ${hourStep} hours`;
    }
    return base.startsWith('Every') ? `${base}, every ${ordinal(hourStep)} hour` : `${base} past every ${ordinal(hourStep)} hour`;
  }
  if (isRun(hours)) {
    const from = `${pad2(hours[0])}:${pad2(minutes[0])}`;
    const to = `${pad2(hours[hours.length - 1])}:${pad2(minutes[minutes.length - 1])}`;
    return `${perHour}, between ${from} and ${to}`;
  }
  return `${base}, during ${hours.length === 1 ? 'hour' : 'hours'} ${describeValues(hours)}`;
}

/** Monday-first ordering so "Saturday and Sunday" and "Friday through Sunday" read naturally. */
function describeWeekdays(days: number[]): string {
  const mondayFirst = days.map(day => (day === 0 ? 7 : day)).sort((a, b) => a - b);
  return describeValues(mondayFirst, value => WEEKDAY_NAMES[value % 7]);
}

function describeMonthDays(days: number[]): string {
  const step = stepFrom(days, 1, 31);
  if (step) {
    return `every ${ordinal(step)} day of the month`;
  }
  return `${days.length === 1 ? 'day' : 'days'} ${describeValues(days)} of the month`;
}

function describeDays(schedule: CronSchedule): string | undefined {
  const domRestricted = !isFull(schedule.daysOfMonth, 1, 31);
  const dowRestricted = !isFull(schedule.daysOfWeek, 0, 6);
  const dom = domRestricted ? describeMonthDays(schedule.daysOfMonth) : undefined;
  const dow = dowRestricted ? describeWeekdays(schedule.daysOfWeek) : undefined;

  if (dom && dow) {
    // Classic cron: either day field matches, unless one of them was written with a leading `*`
    return schedule.domStarred || schedule.dowStarred ? `on ${dom} that is also ${dow}` : `on ${dom}, or on ${dow}`;
  }
  const phrase = dom ?? dow;
  return phrase ? `on ${phrase}` : undefined;
}

function describeMonths(months: number[]): string | undefined {
  if (isFull(months, 1, 12)) {
    return undefined;
  }
  return `in ${describeValues(months, value => MONTH_NAMES[value - 1])}`;
}

export function describeCron(schedule: CronSchedule): string {
  const parts = [
    describeTime(schedule.minutes, schedule.hours),
    describeDays(schedule),
    describeMonths(schedule.months),
  ].filter((part): part is string => part !== undefined);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------------------------
// Upcoming runs
// ---------------------------------------------------------------------------------------------

/** Longest gap between runs of a valid schedule is the 8 years between some Feb 29ths. */
const SEARCH_DAYS = 366 * 9;
const DAY_MS = 86_400_000;

function dayMatches(schedule: CronSchedule, dayOfMonth: number, dayOfWeek: number): boolean {
  const domMatch = schedule.daysOfMonth.includes(dayOfMonth);
  const dowMatch = schedule.daysOfWeek.includes(dayOfWeek);
  return schedule.domStarred || schedule.dowStarred ? domMatch && dowMatch : domMatch || dowMatch;
}

/** The next `count` run times strictly after `after`, evaluating the schedule on the wall clock of `timeZone`. */
export function nextRuns(schedule: CronSchedule, after: Date, timeZone: string, count: number): Date[] {
  const start = wallTimeIn(after.getTime(), timeZone);
  const found = new Set<number>();
  let dayMs = utcFromFields(start.year, start.month, start.day);

  for (let day = 0; day < SEARCH_DAYS && found.size < count; day++, dayMs += DAY_MS) {
    // These are calendar fields stored in a UTC-based Date, not real instants
    const calendar = new Date(dayMs);
    const month = calendar.getUTCMonth() + 1;
    if (!schedule.months.includes(month) || !dayMatches(schedule, calendar.getUTCDate(), calendar.getUTCDay())) {
      continue;
    }
    for (const hour of schedule.hours) {
      for (const minute of schedule.minutes) {
        const instant = zonedToUtc(utcFromFields(calendar.getUTCFullYear(), month, calendar.getUTCDate(), hour, minute), timeZone);
        if (instant > after.getTime()) {
          found.add(instant);
        }
      }
    }
  }
  return [ ...found ].sort((a, b) => a - b).slice(0, count)
    .map(ms => new Date(ms));
}

export interface FieldBreakdown {
  label: string;
  token: string;
  /** What the field expands to, for checking the explanation */
  meaning: string;
}

export function breakdownCron(input: string, schedule: CronSchedule): FieldBreakdown[] {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  const tokens = (trimmed.startsWith('@') ? MACROS[trimmed.toLowerCase()] : trimmed).split(' ');
  const show = (values: number[], min: number, max: number, format?: (value: number) => string) => (
    isFull(values, min, max) ? 'every value' : describeValues(values, format)
  );
  return [
    { label: 'Minute', token: tokens[0], meaning: show(schedule.minutes, 0, 59) },
    { label: 'Hour', token: tokens[1], meaning: show(schedule.hours, 0, 23) },
    { label: 'Day of month', token: tokens[2], meaning: show(schedule.daysOfMonth, 1, 31) },
    { label: 'Month', token: tokens[3], meaning: show(schedule.months, 1, 12, value => MONTH_NAMES[value - 1]) },
    { label: 'Day of week', token: tokens[4], meaning: isFull(schedule.daysOfWeek, 0, 6) ? 'every value' : describeWeekdays(schedule.daysOfWeek) },
  ];
}
