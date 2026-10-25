import { Alert, Code, List, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { LazyCodeEditor } from '../../components/LazyCodeEditor';

import { validateAgainstSchema } from './validate';
import type { Draft } from './validate';

const DRAFTS = [
  { label: 'Draft 2020-12', value: '2020-12' },
  { label: 'Draft 2019-09', value: '2019-09' },
  { label: 'Draft-07', value: 'draft-07' },
];

export function JsonSchemaValidatorTool(): ReactElement {
  const [ draft, setDraft ] = useState<Draft>('2020-12');
  const [ schema, setSchema ] = useState('');
  const [ data, setData ] = useState('');

  const result = useMemo(
    () => (schema.trim() && data.trim() ? validateAgainstSchema(schema, data, draft) : undefined),
    [ schema, data, draft ],
  );

  return (
    <Stack>
      <Select
        label="JSON Schema version"
        data={DRAFTS}
        value={draft}
        onChange={value => setDraft((value ?? '2020-12') as Draft)}
        allowDeselect={false}
        w={200}
      />
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <LazyCodeEditor label="Schema" value={schema} onChange={setSchema} lint />
        <LazyCodeEditor label="Data" value={data} onChange={setData} lint />
      </SimpleGrid>
      {result?.status === 'valid' && <Alert color="green" title="Valid">The data matches the schema.</Alert>}
      {result?.status === 'error' && <Alert color="red" title={`Invalid ${result.source}`}>{result.message}</Alert>}
      {result?.status === 'invalid' && (
        <Alert color="red" title={`${result.issues.length} validation ${result.issues.length === 1 ? 'error' : 'errors'}`}>
          <List spacing="xs">
            {result.issues.map((issue, index) => (
              <List.Item key={index}>
                <Code>{issue.path || '(root)'}</Code> <Text span>{issue.message}</Text>
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}
