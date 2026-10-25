import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { ResultList } from '../../components/ResultList';
import { formatIso, formatRelative, listTimeZones, localTimeZone } from '../timestamp/timestamp';

import { breakdownCron, describeCron, nextRuns, parseCron } from './cron';

const EXAMPLES = [ '*/5 * * * *', '0 9 * * 1-5', '30 4 1 * *', '0 0 29 2 *', '@daily' ];
const RUN_COUNT = 10;

export function CronTool(): ReactElement {
  const [ input, setInput ] = useState('*/15 9-17 * * 1-5');
  const [ timeZone, setTimeZone ] = useState(localTimeZone);
  const [ now, setNow ] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const zones = useMemo(() => listTimeZones(), []);

  const result = useMemo(() => {
    if (!input.trim()) {
      return undefined;
    }
    try {
      const schedule = parseCron(input);
      return { schedule, description: describeCron(schedule), fields: breakdownCron(input, schedule) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not read this expression' };
    }
  }, [ input ]);

  const runs = useMemo(
    () => (result?.schedule ? nextRuns(result.schedule, now, timeZone, RUN_COUNT) : []),
    [ result, now, timeZone ],
  );

  return (
    <Stack>
      <TextInput
        label="Cron expression"
        description="Standard 5 fields: minute hour day-of-month month day-of-week. Macros like @daily work too"
        placeholder="*/15 9-17 * * 1-5"
        value={input}
        onChange={e => setInput(e.currentTarget.value)}
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' }}}
        spellCheck={false}
        error={result?.error}
      />
      <Group gap="xs">
        <Text size="sm" c="dimmed">Examples:</Text>
        {EXAMPLES.map(example => (
          <Button key={example} size="compact-sm" variant="light" onClick={() => setInput(example)} styles={{ label: { fontFamily: 'var(--mantine-font-family-monospace)' }}}>
            {example}
          </Button>
        ))}
      </Group>
      {result?.description && (
        <>
          <Alert color="blue" title="Runs">
            <Text size="lg" fw={500}>{result.description}</Text>
          </Alert>
          <ResultList rows={result.fields.map(field => ({ label: field.label, value: field.token, note: field.meaning }))} />
          <Select
            label="Show next runs in"
            description="Cron uses the server's timezone, so pick the one your scheduler runs in"
            data={zones}
            value={timeZone}
            onChange={value => setTimeZone(value ?? 'UTC')}
            searchable
            allowDeselect={false}
            w={320}
          />
          <Title order={4}>Next {RUN_COUNT} runs</Title>
          {runs.length > 0
            ? <ResultList rows={runs.map((run, index) => ({ label: `#${index + 1}`, value: formatIso(run, timeZone), note: formatRelative(run, now) }))} />
            : <Text c="dimmed">This schedule never runs (for example, February 30th).</Text>}
          {result.schedule && !result.schedule.domStarred && !result.schedule.dowStarred
            && result.schedule.daysOfMonth.length < 31 && result.schedule.daysOfWeek.length < 7 && (
            <Alert color="yellow" title="Day of month and day of week">
              When both are restricted, classic cron runs when either one matches, not only when both do.
            </Alert>
          )}
        </>
      )}
    </Stack>
  );
}
