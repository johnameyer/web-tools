import { Button, Group, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import draft07MetaSchema from 'ajv/dist/refs/json-schema-draft-07.json';

import { LazyCodeEditor } from '../../components/LazyCodeEditor';
import { ValidationResultView } from '../../components/ValidationResultView';
import { validateAgainstSchema } from '../json-schema-validator/validate';
import type { Draft } from '../json-schema-validator/validate';

const DRAFTS = [
  { label: 'Draft 2020-12', value: '2020-12' },
  { label: 'Draft 2019-09', value: '2019-09' },
  { label: 'Draft-07', value: 'draft-07' },
];

const STARTER_SCHEMA = JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    age: { type: 'integer', minimum: 0 },
  },
  required: [ 'name' ],
}, null, 2);

const STARTER_DATA = JSON.stringify({ name: 'Ada', age: 36 }, null, 2);

export function JsonSchemaEditorTool(): ReactElement {
  const [ draft, setDraft ] = useState<Draft>('2020-12');
  const [ schema, setSchema ] = useState(STARTER_SCHEMA);
  const [ data, setData ] = useState(STARTER_DATA);

  const result = useMemo(
    () => (schema.trim() && data.trim() ? validateAgainstSchema(schema, data, draft) : undefined),
    [ schema, data, draft ],
  );

  const formatSchema = () => {
    try {
      setSchema(JSON.stringify(JSON.parse(schema), null, 2));
    } catch {
      // Invalid JSON is already flagged inline by the editor
    }
  };

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Select
          label="Validate sample data as"
          data={DRAFTS}
          value={draft}
          onChange={value => setDraft((value ?? '2020-12') as Draft)}
          allowDeselect={false}
          w={200}
        />
        <Button variant="default" onClick={formatSchema} disabled={!schema.trim()}>Format schema</Button>
      </Group>
      <Text size="sm" c="dimmed">
        The schema editor suggests keywords (Ctrl+Space) and shows their documentation on hover, based on the
        draft-07 meta-schema. Newer keywords such as <code>prefixItems</code> are accepted but not suggested.
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <LazyCodeEditor label="Schema" value={schema} onChange={setSchema} lint schema={draft07MetaSchema} foldControls minHeight="400px" />
        <LazyCodeEditor label="Sample data" value={data} onChange={setData} lint foldControls minHeight="400px" />
      </SimpleGrid>
      <ValidationResultView result={result} />
    </Stack>
  );
}
