import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { Button, Group, Input, Stack, useComputedColorScheme } from '@mantine/core';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { collapseAll, expandAll } from './folding';

export interface CodeEditorProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Show inline JSON syntax errors */
  lint?: boolean;
  /** Adds keyword hover docs, autocomplete and validation for documents that must conform to this schema */
  schema?: object;
  /** Show Collapse all / Expand all buttons */
  foldControls?: boolean;
  minHeight?: string;
}

// Default export so it can be lazy-loaded; use LazyCodeEditor from other modules.
export default function CodeEditor({ label, value, onChange, readOnly, lint = false, schema, foldControls = false, minHeight = '240px' }: CodeEditorProps): ReactElement {
  const colorScheme = useComputedColorScheme('light');
  const id = useId();
  const viewRef = useRef<EditorView>(null);

  // Schema support is large, so it is only fetched for editors that ask for it
  const [ schemaExtension, setSchemaExtension ] = useState<Extension>();
  useEffect(() => {
    if (!schema) {
      return;
    }
    let cancelled = false;
    import('codemirror-json-schema').then(({ jsonSchema }) => {
      if (!cancelled) {
        setSchemaExtension(jsonSchema(schema as Parameters<typeof jsonSchema>[0]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ schema ]);

  const extensions = useMemo(() => {
    const result: Extension[] = [ json() ];
    if (lint) {
      result.push(linter(jsonParseLinter()), lintGutter());
    }
    if (schema && schemaExtension) {
      result.push(schemaExtension);
    }
    return result;
  }, [ lint, schema, schemaExtension ]);

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
        extensions={extensions}
        basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly }}
        aria-label={label}
      />
    </Stack>
  );
}
