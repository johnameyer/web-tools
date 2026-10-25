import { Button, CopyButton, Group, Stack, Textarea } from '@mantine/core';
import type { ReactElement, ReactNode } from 'react';

interface TextConverterProps {
  /** Mode toggles and options rendered above the input */
  controls: ReactNode;
  input: string;
  onInputChange: (value: string) => void;
  output: string;
  error?: string;
}

/** Shared layout for tools that turn one text box into another. */
export function TextConverter({ controls, input, onInputChange, output, error }: TextConverterProps): ReactElement {
  return (
    <Stack>
      <Group justify="space-between">{controls}</Group>
      <Textarea
        label="Input"
        autosize
        minRows={6}
        value={input}
        onChange={e => onInputChange(e.currentTarget.value)}
        error={input ? error : undefined}
      />
      <Textarea label="Output" autosize minRows={6} readOnly value={output} />
      <Group>
        <CopyButton value={output}>
          {({ copied, copy }) => (
            <Button onClick={copy} disabled={!output}>{copied ? 'Copied' : 'Copy output'}</Button>
          )}
        </CopyButton>
        <Button variant="default" onClick={() => onInputChange('')} disabled={!input}>Clear</Button>
      </Group>
    </Stack>
  );
}
