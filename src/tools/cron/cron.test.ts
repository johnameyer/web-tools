import { describe, expect, it } from 'vitest';

import { breakdownCron, describeCron, nextRuns, parseCron } from './cron';

const explain = (expression: string) => describeCron(parseCron(expression));

describe('describeCron', () => {
  it.each([
    // Minutes and hours
    [ '* * * * *', 'Every minute' ],
    [ '*/5 * * * *', 'Every 5 minutes' ],
    [ '0,15,30,45 * * * *', 'Every 15 minutes' ],
    [ '0 * * * *', 'Every hour' ],
    [ '30 * * * *', 'At minute 30 past every hour' ],
    [ '0-5 * * * *', 'At minutes 0 through 5 past every hour' ],
    [ '5/15 * * * *', 'At minutes 5, 20, 35 and 50 past every hour' ],
    [ '5 4 * * *', 'At 04:05' ],
    [ '0 0 * * *', 'At 00:00' ],
    [ '0 9,17 * * *', 'At 09:00 and 17:00' ],
    [ '0 9,12,18 * * *', 'At 09:00, 12:00 and 18:00' ],
    [ '0,30 9,17 * * *', 'At 09:00, 09:30, 17:00 and 17:30' ],
    [ '0 */2 * * *', 'Every 2 hours' ],
    [ '15 */2 * * *', 'At minute 15 past every 2nd hour' ],
    [ '*/10 */2 * * *', 'Every 10 minutes, every 2nd hour' ],
    [ '0 9-17 * * *', 'Every hour, between 09:00 and 17:00' ],
    [ '30 9-17 * * *', 'At minute 30 past every hour, between 09:30 and 17:30' ],
    [ '* 9 * * *', 'Every minute, between 09:00 and 09:59' ],
    [ '*/5 0 * * *', 'Every 5 minutes, between 00:00 and 00:55' ],
    [ '*/15 9 * * *', 'At 09:00, 09:15, 09:30 and 09:45' ],
    [ '*/5 9,12,18 * * *', 'Every 5 minutes, during hours 9, 12 and 18' ],
    [ '1-7 9,12 * * *', 'At minutes 1 through 7, during hours 9 and 12' ],
    // Days
    [ '0 9 * * 1-5', 'At 09:00, on Monday through Friday' ],
    [ '*/15 9-17 * * 1-5', 'Every 15 minutes, between 09:00 and 17:45, on Monday through Friday' ],
    [ '0 0 * * 6,0', 'At 00:00, on Saturday and Sunday' ],
    [ '0 0 * * 5-7', 'At 00:00, on Friday through Sunday' ],
    [ '0 0 * * SUN', 'At 00:00, on Sunday' ],
    [ '0 0 * * 1,3,5', 'At 00:00, on Monday, Wednesday and Friday' ],
    [ '0 0 * * 0-7', 'At 00:00' ],
    [ '0 0 1 * *', 'At 00:00, on day 1 of the month' ],
    [ '0 0 1,15 * *', 'At 00:00, on days 1 and 15 of the month' ],
    [ '0 0 1-7 * *', 'At 00:00, on days 1 through 7 of the month' ],
    [ '0 0 */2 * *', 'At 00:00, on every 2nd day of the month' ],
    [ '0 0 ? * MON', 'At 00:00, on Monday' ],
    // Months
    [ '0 0 1 1 *', 'At 00:00, on day 1 of the month, in January' ],
    [ '0 0 * 1-3 *', 'At 00:00, in January through March' ],
    [ '0 0 * JAN-MAR *', 'At 00:00, in January through March' ],
    [ '0 0 * jan,apr,jul,oct *', 'At 00:00, in January, April, July and October' ],
    // Both day fields
    [ '0 0 13 * 5', 'At 00:00, on day 13 of the month, or on Friday' ],
    [ '0 0 */2 * 1', 'At 00:00, on every 2nd day of the month that is also Monday' ],
    // Macros
    [ '@hourly', 'Every hour' ],
    [ '@daily', 'At 00:00' ],
    [ '@midnight', 'At 00:00' ],
    [ '@weekly', 'At 00:00, on Sunday' ],
    [ '@monthly', 'At 00:00, on day 1 of the month' ],
    [ '@yearly', 'At 00:00, on day 1 of the month, in January' ],
    [ '  0   9  *  *  1-5  ', 'At 09:00, on Monday through Friday' ],
  ])('%s -> %s', (expression, expected) => {
    expect(explain(expression)).toBe(expected);
  });
});

describe('parseCron errors', () => {
  it.each([
    [ '', 'Enter a cron expression' ],
    [ '* * * *', 'Expected 5 fields (minute hour day-of-month month day-of-week) but found 4' ],
    [ '* * * * * *', 'This has 6 fields' ],
    [ '60 * * * *', 'Minute: 60 is out of range (0-59)' ],
    [ '* 24 * * *', 'Hour: 24 is out of range (0-23)' ],
    [ '* * 0 * *', 'Day of month: 0 is out of range (1-31)' ],
    [ '* * 32 * *', 'Day of month: 32 is out of range (1-31)' ],
    [ '* * * 13 *', 'Month: 13 is out of range (1-12)' ],
    [ '* * * * 8', 'Day of week: 8 is out of range (0-7)' ],
    [ '*/0 * * * *', 'Minute: step "0" must be a whole number of at least 1' ],
    [ '*/x * * * *', 'Minute: step "x" must be a whole number of at least 1' ],
    [ '5-1 * * * *', 'Minute: range "5-1" runs backwards' ],
    [ '1-2-3 * * * *', 'Minute: "1-2-3" is not a valid value or range' ],
    [ '1,,2 * * * *', 'Minute: empty entry in "1,,2"' ],
    [ '1/2/3 * * * *', 'Minute: "1/2/3" has more than one step' ],
    [ '* * * FOO *', 'Month: "FOO" is not a valid value' ],
    [ '* * * January *', 'Month: "January" is not a valid value' ],
    [ '? * * * *', 'Minute: "?" is not a valid value' ],
    [ '@reboot', 'no schedule to explain' ],
    [ '@sometimes', 'Unknown macro @sometimes' ],
  ])('%j -> %s', (expression, message) => {
    expect(() => parseCron(expression)).toThrow(message);
  });
});

describe('parseCron semantics', () => {
  it('expands lists, ranges and steps', () => {
    const schedule = parseCron('0-10/5,30 8 1,15 */4 MON-WED');
    expect(schedule.minutes).toEqual([ 0, 5, 10, 30 ]);
    expect(schedule.hours).toEqual([ 8 ]);
    expect(schedule.daysOfMonth).toEqual([ 1, 15 ]);
    expect(schedule.months).toEqual([ 1, 5, 9 ]);
    expect(schedule.daysOfWeek).toEqual([ 1, 2, 3 ]);
  });

  it('folds day-of-week 7 into Sunday', () => {
    expect(parseCron('0 0 * * 7').daysOfWeek).toEqual([ 0 ]);
    expect(parseCron('0 0 * * 0,7').daysOfWeek).toEqual([ 0 ]);
  });

  it('records whether a day field was written starting with a star', () => {
    expect(parseCron('0 0 */2 * 1')).toMatchObject({ domStarred: true, dowStarred: false });
    expect(parseCron('0 0 13 * 5')).toMatchObject({ domStarred: false, dowStarred: false });
    expect(parseCron('0 0 ? * MON')).toMatchObject({ domStarred: true });
  });
});

describe('nextRuns', () => {
  const iso = (dates: Date[]) => dates.map(date => date.toISOString());

  it('lists upcoming runs in order', () => {
    expect(iso(nextRuns(parseCron('*/15 * * * *'), new Date('2024-01-01T10:07:30Z'), 'UTC', 3)))
      .toEqual([ '2024-01-01T10:15:00.000Z', '2024-01-01T10:30:00.000Z', '2024-01-01T10:45:00.000Z' ]);
  });

  it('only returns runs strictly after the given time', () => {
    expect(iso(nextRuns(parseCron('*/15 * * * *'), new Date('2024-01-01T10:15:00Z'), 'UTC', 1))).toEqual([ '2024-01-01T10:30:00.000Z' ]);
  });

  it('skips weekends for a weekday schedule', () => {
    // 2024-01-05 is a Friday
    expect(iso(nextRuns(parseCron('0 9 * * 1-5'), new Date('2024-01-05T10:00:00Z'), 'UTC', 2)))
      .toEqual([ '2024-01-08T09:00:00.000Z', '2024-01-09T09:00:00.000Z' ]);
  });

  it('finds the next leap day', () => {
    expect(iso(nextRuns(parseCron('0 0 29 2 *'), new Date('2024-03-01T00:00:00Z'), 'UTC', 1))).toEqual([ '2028-02-29T00:00:00.000Z' ]);
  });

  it('matches either day field when neither is starred', () => {
    // September 2024: day 13 is a Friday, and Fridays fall on 6, 13, 20 and 27
    expect(iso(nextRuns(parseCron('0 0 13 * 5'), new Date('2024-09-01T00:00:00Z'), 'UTC', 3)))
      .toEqual([ '2024-09-06T00:00:00.000Z', '2024-09-13T00:00:00.000Z', '2024-09-20T00:00:00.000Z' ]);
    // And with a day-of-month on the 20th instead, the 20th also appears even though it is not a Friday
    expect(iso(nextRuns(parseCron('0 0 10 * 5'), new Date('2024-09-01T00:00:00Z'), 'UTC', 3)))
      .toEqual([ '2024-09-06T00:00:00.000Z', '2024-09-10T00:00:00.000Z', '2024-09-13T00:00:00.000Z' ]);
  });

  it('requires both day fields when one is starred', () => {
    // Odd days of the month that are also Mondays
    expect(iso(nextRuns(parseCron('0 0 */2 * 1'), new Date('2024-09-01T00:00:00Z'), 'UTC', 3)))
      .toEqual([ '2024-09-09T00:00:00.000Z', '2024-09-23T00:00:00.000Z', '2024-10-07T00:00:00.000Z' ]);
  });

  it('evaluates the schedule on the wall clock of the chosen timezone, across DST', () => {
    const daily9 = parseCron('0 9 * * *');
    expect(iso(nextRuns(daily9, new Date('2024-01-15T00:00:00Z'), 'America/New_York', 1))).toEqual([ '2024-01-15T14:00:00.000Z' ]);
    expect(iso(nextRuns(daily9, new Date('2024-07-15T00:00:00Z'), 'America/New_York', 1))).toEqual([ '2024-07-15T13:00:00.000Z' ]);
    expect(iso(nextRuns(daily9, new Date('2024-01-15T00:00:00Z'), 'Asia/Kolkata', 1))).toEqual([ '2024-01-15T03:30:00.000Z' ]);
  });

  it('keeps results ordered and unique around a DST transition', () => {
    const runs = nextRuns(parseCron('30 2 * * *'), new Date('2024-03-08T00:00:00Z'), 'America/New_York', 5).map(date => date.getTime());
    expect(runs).toHaveLength(5);
    expect([ ...runs ].sort((a, b) => a - b)).toEqual(runs);
    expect(new Set(runs).size).toBe(5);
  });

  it('returns nothing for a date that never occurs', () => {
    expect(nextRuns(parseCron('0 0 31 2 *'), new Date('2024-01-01T00:00:00Z'), 'UTC', 3)).toEqual([]);
  });

  it('handles every-minute schedules and long daily lists quickly', () => {
    const started = Date.now();
    expect(nextRuns(parseCron('* * * * *'), new Date('2024-01-01T00:00:00Z'), 'UTC', 10)).toHaveLength(10);
    expect(nextRuns(parseCron('0 0 * * *'), new Date('2024-01-01T00:00:00Z'), 'UTC', 400)).toHaveLength(400);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('breakdownCron', () => {
  it('pairs each token with what it expands to', () => {
    expect(breakdownCron('*/15 9-17 * JAN-MAR 1-5', parseCron('*/15 9-17 * JAN-MAR 1-5'))).toEqual([
      { label: 'Minute', token: '*/15', meaning: '0, 15, 30 and 45' },
      { label: 'Hour', token: '9-17', meaning: '9 through 17' },
      { label: 'Day of month', token: '*', meaning: 'every value' },
      { label: 'Month', token: 'JAN-MAR', meaning: 'January through March' },
      { label: 'Day of week', token: '1-5', meaning: 'Monday through Friday' },
    ]);
  });

  it('shows the expansion of a macro', () => {
    expect(breakdownCron('@daily', parseCron('@daily')).map(field => field.token)).toEqual([ '0', '0', '*', '*', '*' ]);
  });
});
