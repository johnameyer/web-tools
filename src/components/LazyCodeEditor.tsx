import { Skeleton } from '@mantine/core';
import { lazy, Suspense } from 'react';
import type { ReactElement } from 'react';

import type { CodeEditorProps } from './CodeEditor';

const CodeEditor = lazy(() => import('./CodeEditor'));

/** Loads CodeMirror on demand so it stays out of the main bundle. */
export function LazyCodeEditor(props: CodeEditorProps): ReactElement {
  return (
    <Suspense fallback={<Skeleton height={props.minHeight ?? 240} aria-label={`Loading ${props.label}`} />}>
      <CodeEditor {...props} />
    </Suspense>
  );
}
