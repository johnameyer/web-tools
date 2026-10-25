import { Alert, Button, CopyButton, Group, Select, Stack, Switch } from '@mantine/core';
import { useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { LazyCodeEditor } from '../../components/LazyCodeEditor';

import { formatText, parseJson } from './json';

const INDENTS = [
  { label: '2 spaces', value: '2' },
  { label: '4 spaces', value: '4' },
  { label: 'Tab', value: 'tab' },
];

export function JsonFormatTool(): ReactElement {
  const [ text, setText ] = useState('');
  const [ indent, setIndent ] = useState('2');
  const [ sortKeys, setSortKeys ] = useState(false);
  const [ formatOnPaste, setFormatOnPaste ] = useState(true);
  // Set just before the editor handles a paste, so the resulting change can be formatted
  const pastingRef = useRef(false);

  const error = useMemo(() => {
    if (!text.trim()) {
      return undefined;
    }
    const parsed = parseJson(text);
    return parsed.ok ? undefined : parsed.error;
  }, [ text ]);

  const options = (minify: boolean) => ({
    indent: minify ? 0 : indent === 'tab' ? 'tab' as const : Number(indent),
    sortKeys,
  });

  const apply = (source: string, minify: boolean) => {
    const result = formatText(source, options(minify));
    setText(result.ok ? result.text : source);
  };

  const handleChange = (value: string) => {
    if (pastingRef.current) {
      pastingRef.current = false;
      if (formatOnPaste && value.trim()) {
        apply(value, false);
        return;
      }
    }
    setText(value);
  };

  const location = error?.line ? ` (line ${error.line}, column ${error.column})` : '';
  const canFormat = text.trim() !== '' && !error;

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button onClick={() => apply(text, false)} disabled={!canFormat}>Format</Button>
          <Button variant="default" onClick={() => apply(text, true)} disabled={!canFormat}>Minify</Button>
        </Group>
        <Group>
          <Select aria-label="Indent" data={INDENTS} value={indent} onChange={value => setIndent(value ?? '2')} allowDeselect={false} w={130} />
          <Switch label="Sort keys" checked={sortKeys} onChange={e => setSortKeys(e.currentTarget.checked)} />
          <Switch label="Format on paste" checked={formatOnPaste} onChange={e => setFormatOnPaste(e.currentTarget.checked)} />
        </Group>
      </Group>
      {/* Capture phase: the editor consumes paste events before a bubbling handler would see them */}
      <div
        onPasteCapture={() => {
          pastingRef.current = true;
          setTimeout(() => {
            pastingRef.current = false;
          }, 0);
        }}
      >
        <LazyCodeEditor label="JSON" value={text} onChange={handleChange} lint foldControls minHeight="360px" />
      </div>
      {error && <Alert color="red" title="Invalid JSON">{error.message}{location}</Alert>}
      <Group>
        <CopyButton value={text}>
          {({ copied, copy }) => (
            <Button variant="default" onClick={copy} disabled={!text}>{copied ? 'Copied' : 'Copy'}</Button>
          )}
        </CopyButton>
        <Button variant="default" onClick={() => setText('')} disabled={!text}>Clear</Button>
      </Group>
    </Stack>
  );
}
