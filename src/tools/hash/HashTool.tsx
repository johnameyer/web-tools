import { Alert, FileInput, Group, SegmentedControl, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { ResultList } from '../../components/ResultList';

import { ALGORITHMS, encodeBytes, hashAll } from './hash';
import type { HashResults, OutputFormat } from './hash';

type InputMode = 'text' | 'file';

const FORMATS = [
  { label: 'hex', value: 'hex' },
  { label: 'HEX', value: 'HEX' },
  { label: 'Base64', value: 'base64' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function HashTool(): ReactElement {
  const [ mode, setMode ] = useState<InputMode>('text');
  const [ text, setText ] = useState('');
  const [ file, setFile ] = useState<File | null>(null);
  const [ useHmac, setUseHmac ] = useState(false);
  const [ hmacKey, setHmacKey ] = useState('');
  const [ format, setFormat ] = useState<OutputFormat>('hex');
  const [ computed, setComputed ] = useState<{ id: string; results?: HashResults; error?: string }>();

  const hasInput = mode === 'text' ? text !== '' : file !== null;
  const fileId = file ? `${file.name}:${file.size}:${file.lastModified}` : '';
  // Identifies the inputs a result belongs to, so a stale result is never shown for new inputs
  const requestId = `${mode}|${mode === 'text' ? text : fileId}|${useHmac}|${useHmac ? hmacKey : ''}`;

  useEffect(() => {
    if (!hasInput) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = mode === 'text' ? new TextEncoder().encode(text) : new Uint8Array(await file!.arrayBuffer());
        const key = useHmac ? new TextEncoder().encode(hmacKey) : undefined;
        const results = await hashAll(data, key);
        if (!cancelled) {
          setComputed({ id: requestId, results });
        }
      } catch (e) {
        if (!cancelled) {
          setComputed({ id: requestId, error: e instanceof Error ? e.message : 'Could not hash this input' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ hasInput, mode, text, file, useHmac, hmacKey, requestId ]);

  const current = hasInput && computed?.id === requestId ? computed : undefined;
  const rows = current?.results
    ? ALGORITHMS.map(algorithm => ({
      label: useHmac ? `HMAC-${algorithm}` : algorithm,
      value: encodeBytes(current.results![algorithm], format),
    }))
    : [];

  return (
    <Stack>
      <SegmentedControl
        aria-label="Input type"
        value={mode}
        onChange={value => setMode(value as InputMode)}
        data={[
          { label: 'Text', value: 'text' },
          { label: 'File', value: 'file' },
        ]}
        style={{ alignSelf: 'flex-start' }}
      />
      {mode === 'text' ? (
        <Textarea
          label="Text"
          description="Hashed as UTF-8, exactly as typed (no trailing newline is added)"
          autosize
          minRows={5}
          value={text}
          onChange={e => setText(e.currentTarget.value)}
        />
      ) : (
        <Stack gap="xs">
          <FileInput label="File" description="Read in your browser; nothing is uploaded" placeholder="Choose a file" value={file} onChange={setFile} clearable />
          {file && <Text size="sm" c="dimmed">{file.name} · {formatSize(file.size)}</Text>}
        </Stack>
      )}
      <Group align="flex-end" justify="space-between">
        <Group align="flex-end">
          <Switch label="HMAC" checked={useHmac} onChange={e => setUseHmac(e.currentTarget.checked)} />
          {useHmac && (
            <TextInput label="Secret key" value={hmacKey} onChange={e => setHmacKey(e.currentTarget.value)} w={260} spellCheck={false} />
          )}
        </Group>
        <SegmentedControl aria-label="Output format" value={format} onChange={value => setFormat(value as OutputFormat)} data={FORMATS} />
      </Group>
      {current?.error && <Alert color="red" title="Can't hash that">{current.error}</Alert>}
      {current?.results && (
        <ResultList rows={rows} />
      )}
      <Text size="sm" c="dimmed">MD5 and SHA-1 are broken for security purposes; they are fine for checksums.</Text>
    </Stack>
  );
}
