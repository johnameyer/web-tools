import { Alert, Button, CopyButton, Group, NumberInput, Select, Stack, Switch, Table, Tabs, Text, Textarea, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { formatIso, formatRelative } from '../timestamp/timestamp';

import { createUlidGenerator, createUuidV7Generator, parseId, uuidV4 } from './ids';

type IdType = 'uuid-v4' | 'uuid-v7' | 'ulid';

const TYPES = [
  { label: 'UUID v4 (random)', value: 'uuid-v4' },
  { label: 'UUID v7 (time-ordered)', value: 'uuid-v7' },
  { label: 'ULID (time-ordered)', value: 'ulid' },
];

function generate(type: IdType, count: number): string[] {
  const now = Date.now();
  if (type === 'uuid-v4') {
    return Array.from({ length: count }, () => uuidV4());
  }
  const next = type === 'uuid-v7' ? createUuidV7Generator() : createUlidGenerator();
  return Array.from({ length: count }, () => next(now));
}

function Generate(): ReactElement {
  const [ type, setType ] = useState<IdType>('uuid-v4');
  const [ count, setCount ] = useState(5);
  const [ uppercase, setUppercase ] = useState(false);
  const [ hyphens, setHyphens ] = useState(true);
  const [ ids, setIds ] = useState(() => generate('uuid-v4', 5));

  const isUuid = type !== 'ulid';
  const output = ids
    .map(id => {
      if (!isUuid) {
        return id;
      }
      const text = hyphens ? id : id.replace(/-/g, '');
      return uppercase ? text.toUpperCase() : text;
    })
    .join('\n');

  const update = (nextType: IdType, nextCount: number) => {
    setType(nextType);
    setCount(nextCount);
    setIds(generate(nextType, nextCount));
  };

  return (
    <Stack>
      <Group align="flex-end">
        <Select label="Type" data={TYPES} value={type} onChange={value => update((value ?? 'uuid-v4') as IdType, count)} allowDeselect={false} w={240} />
        <NumberInput
          label="Count"
          min={1}
          max={100}
          allowDecimal={false}
          clampBehavior="strict"
          value={count}
          onChange={value => typeof value === 'number' && update(type, value)}
          w={100}
        />
        <Button onClick={() => setIds(generate(type, count))}>Generate</Button>
      </Group>
      {isUuid && (
        <Group>
          <Switch label="Uppercase" checked={uppercase} onChange={e => setUppercase(e.currentTarget.checked)} />
          <Switch label="Hyphens" checked={hyphens} onChange={e => setHyphens(e.currentTarget.checked)} />
        </Group>
      )}
      <Textarea label="Generated" readOnly autosize minRows={3} maxRows={16} value={output} styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' }}} />
      <Group>
        <CopyButton value={output}>
          {({ copied, copy }) => <Button variant="default" onClick={copy}>{copied ? 'Copied' : 'Copy all'}</Button>}
        </CopyButton>
      </Group>
      <Text size="sm" c="dimmed">
        {type === 'uuid-v4' ? 'Generated' : 'Time-ordered IDs from one batch sort in creation order. Generated'} in your browser with its secure random source.
      </Text>
    </Stack>
  );
}

function Inspect(): ReactElement {
  const [ input, setInput ] = useState('');
  const [ now, setNow ] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const result = useMemo(() => {
    if (!input.trim()) {
      return undefined;
    }
    try {
      return { details: parseId(input) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not read this ID' };
    }
  }, [ input ]);

  const details = result?.details;
  const rows: { label: string; value: string }[] = [];
  if (details) {
    rows.push({ label: 'Type', value: details.type });
    if (details.variant) {
      rows.push({ label: 'Variant', value: details.variant });
    }
    if (details.timestamp) {
      rows.push(
        { label: 'Timestamp (UTC)', value: formatIso(details.timestamp, 'UTC') },
        { label: 'Relative', value: formatRelative(details.timestamp, now) },
        { label: 'Unix milliseconds', value: String(details.timestamp.getTime()) },
      );
    }
    if (details.randomHex) {
      rows.push({ label: 'Random part (hex)', value: details.randomHex });
    }
    rows.push(
      { label: details.kind === 'ULID' ? 'As UUID' : 'UUID', value: details.uuid },
      { label: 'UUID (uppercase)', value: details.uuid.toUpperCase() },
      { label: 'UUID (no hyphens)', value: details.uuid.replace(/-/g, '') },
      { label: details.kind === 'ULID' ? 'ULID' : 'As ULID', value: details.ulid },
    );
  }

  return (
    <Stack>
      <TextInput
        label="UUID or ULID"
        description="Hyphenated, plain, {braced} or urn:uuid: forms all work"
        placeholder="017f22e2-79b0-7cc3-98c4-dc0c0c07398f"
        value={input}
        onChange={e => setInput(e.currentTarget.value)}
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' }}}
        spellCheck={false}
      />
      {result?.error && <Alert color="red" title="Can't read that">{result.error}</Alert>}
      {details && (
        <Table withTableBorder>
          <Table.Tbody>
            {rows.map(row => (
              <Table.Tr key={row.label}>
                <Table.Th scope="row" w={190}>{row.label}</Table.Th>
                <Table.Td style={{ fontFamily: 'var(--mantine-font-family-monospace)', wordBreak: 'break-all' }}>{row.value}</Table.Td>
                <Table.Td w={90}>
                  <CopyButton value={row.value}>
                    {({ copied, copy }) => (
                      <Button size="compact-sm" variant="subtle" onClick={copy} aria-label={`Copy ${row.label}`}>{copied ? 'Copied' : 'Copy'}</Button>
                    )}
                  </CopyButton>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

export function IdTool(): ReactElement {
  return (
    <Tabs defaultValue="generate" keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="generate">Generate</Tabs.Tab>
        <Tabs.Tab value="inspect">Inspect</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="generate"><Generate /></Tabs.Panel>
      <Tabs.Panel value="inspect"><Inspect /></Tabs.Panel>
    </Tabs>
  );
}
