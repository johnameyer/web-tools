import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { Button, Group, Input, Stack, useComputedColorScheme } from '@mantine/core';
import CodeMirror from '@uiw/react-codemirror';
import { useId, useRef } from 'react';
import type { ReactElement } from 'react';

import { collapseAll, expandAll } from './folding';

export interface CodeEditorProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Show inline JSON syntax errors */
  lint?: boolean;
  /** Show Collapse all / Expand all buttons */
  foldControls?: boolean;
  minHeight?: string;
}

// Default export so it can be lazy-loaded; use LazyCodeEditor from other modules.
export default function CodeEditor({ label, value, onChange, readOnly, lint = false, foldControls = false, minHeight = '240px' }: CodeEditorProps): ReactElement {
  const colorScheme = useComputedColorScheme('light');
  const id = useId();
  const viewRef = useRef<EditorView>(null);

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="flex-end">
        <Input.Label htmlFor={id}>{label}</Input.Label>
        {foldControls && (
          <Group gap="xs">
            <Button size="compact-xs" variant="subtle" onClick={() => viewRef.current && collapseAll(viewRef.current)}>
              Collapse all
            </Button>
            <Button size="compact-xs" variant="subtle" onClick={() => viewRef.current && expandAll(viewRef.current)}>
              Expand all
            </Button>
          </Group>
        )}
      </Group>
      <CodeMirror
        id={id}
        value={value}
        onChange={onChange}
        onCreateEditor={view => {
          viewRef.current = view;
        }}
        readOnly={readOnly}
        editable={!readOnly}
        theme={colorScheme}
        minHeight={minHeight}
        maxHeight="600px"
        extensions={lint ? [ json(), linter(jsonParseLinter()), lintGutter() ] : [ json() ]}
        basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly }}
        aria-label={label}
      />
    </Stack>
  );
}
