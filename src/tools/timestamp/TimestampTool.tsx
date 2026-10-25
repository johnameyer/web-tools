import { Alert, Badge, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { ResultList } from '../../components/ResultList';

import { buildOutputs, listTimeZones, localTimeZone, parseTimestamp } from './timestamp';

export function TimestampTool(): ReactElement {
  const [ input, setInput ] = useState('');
  const [ timeZone, setTimeZone ] = useState(localTimeZone);
  const [ now, setNow ] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const zones = useMemo(() => listTimeZones(), []);

  const result = useMemo(() => {
    if (!input.trim()) {
      return undefined;
    }
    try {
      const parsed = parseTimestamp(input, timeZone);
      return { detected: parsed.detected, date: parsed.date };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not read this timestamp' };
    }
  }, [ input, timeZone ]);

  const rows = result?.date ? buildOutputs(result.date, timeZone, now) : [];

  return (
    <Stack>
      <Group align="flex-end" wrap="wrap">
        <TextInput
          label="Timestamp"
          description="Unix epoch (seconds to nanoseconds) or an ISO 8601 date"
          placeholder="1700000000 or 2023-11-14T22:13:20Z"
          value={input}
          onChange={e => setInput(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 260 }}
        />
        <Button variant="default" onClick={() => setInput(new Date().toISOString())}>Now</Button>
      </Group>
      <Select
        label="Timezone"
        description="Used for input without an offset, and for the displayed times"
        data={zones}
        value={timeZone}
        onChange={value => setTimeZone(value ?? 'UTC')}
        searchable
        allowDeselect={false}
        w={320}
      />
      <Text size="sm" c="dimmed">
        Current time: {Math.floor(now.getTime() / 1000)} s · {now.getTime()} ms
      </Text>
      {result?.error && <Alert color="red" title="Can't read that">{result.error}</Alert>}
      {result?.detected && (
        <>
          <Badge variant="light" size="lg" style={{ alignSelf: 'flex-start', textTransform: 'none' }}>{result.detected}</Badge>
          <ResultList rows={rows} />
        </>
      )}
    </Stack>
  );
}
