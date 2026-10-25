import { SegmentedControl } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { TextConverter } from '../../components/TextConverter';

import { decodeUri, encodeUri } from './uri';
import type { UriScope } from './uri';

type Mode = 'encode' | 'decode';

function convert(mode: Mode, scope: UriScope, input: string): { output: string; error?: string } {
  try {
    return { output: mode === 'encode' ? encodeUri(input, scope) : decodeUri(input, scope) };
  } catch (e) {
    return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
  }
}

export function UriTool(): ReactElement {
  const [ mode, setMode ] = useState<Mode>('encode');
  const [ scope, setScope ] = useState<UriScope>('component');
  const [ input, setInput ] = useState('');

  const { output, error } = useMemo(() => convert(mode, scope, input), [ mode, scope, input ]);

  return (
    <TextConverter
      input={input}
      onInputChange={setInput}
      output={output}
      error={error}
      controls={(
        <>
          <SegmentedControl
            aria-label="Mode"
            value={mode}
            onChange={value => setMode(value as Mode)}
            data={[
              { label: 'Encode', value: 'encode' },
              { label: 'Decode', value: 'decode' },
            ]}
          />
          <SegmentedControl
            aria-label="Scope"
            value={scope}
            onChange={value => setScope(value as UriScope)}
            data={[
              { label: 'Component', value: 'component' },
              { label: 'Full URI', value: 'full' },
            ]}
          />
        </>
      )}
    />
  );
}
