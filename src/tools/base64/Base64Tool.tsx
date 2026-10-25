import { Button, CopyButton, Group, SegmentedControl, Stack, Switch, Textarea } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { decodeBase64, encodeBase64 } from './base64';

type Mode = 'encode' | 'decode';

function convert(mode: Mode, input: string, urlSafe: boolean): { output: string; error?: string } {
  try {
    return { output: mode === 'encode' ? encodeBase64(input, urlSafe) : decodeBase64(input) };
  } catch (e) {
    return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
  }
}

export function Base64Tool(): ReactElement {
  const [ mode, setMode ] = useState<Mode>('encode');
  const [ urlSafe, setUrlSafe ] = useState(false);
  const [ input, setInput ] = useState('');

  const { output, error } = useMemo(() => convert(mode, input, urlSafe), [ mode, input, urlSafe ]);

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          aria-label="Mode"
          value={mode}
          onChange={value => setMode(value as Mode)}
          data={[
            { label: 'Encode', value: 'encode' },
            { label: 'Decode', value: 'decode' },
          ]}
        />
        {mode === 'encode' && (
          <Switch label="URL-safe" checked={urlSafe} onChange={e => setUrlSafe(e.currentTarget.checked)} />
        )}
      </Group>
      <Textarea
        label="Input"
        autosize
        minRows={6}
        value={input}
        onChange={e => setInput(e.currentTarget.value)}
        error={input ? error : undefined}
      />
      <Textarea label="Output" autosize minRows={6} readOnly value={output} />
      <Group>
        <CopyButton value={output}>
          {({ copied, copy }) => (
            <Button onClick={copy} disabled={!output}>{copied ? 'Copied' : 'Copy output'}</Button>
          )}
        </CopyButton>
        <Button variant="default" onClick={() => setInput('')} disabled={!input}>Clear</Button>
      </Group>
    </Stack>
  );
}
