import { Alert, Code, List, Text } from '@mantine/core';
import type { ReactElement } from 'react';

import type { ValidationResult } from '../tools/json-schema-validator/validate';

export function ValidationResultView({ result }: { result: ValidationResult | undefined }): ReactElement | null {
  if (!result) {
    return null;
  }
  switch (result.status) {
    case 'valid':
      return <Alert color="green" title="Valid">The data matches the schema.</Alert>;
    case 'error':
      return <Alert color="red" title={`Invalid ${result.source}`}>{result.message}</Alert>;
    case 'invalid':
      return (
        <Alert color="red" title={`${result.issues.length} validation ${result.issues.length === 1 ? 'error' : 'errors'}`}>
          <List spacing="xs">
            {result.issues.map((issue, index) => (
              <List.Item key={index}>
                <Code>{issue.path || '(root)'}</Code> <Text span>{issue.message}</Text>
              </List.Item>
            ))}
          </List>
        </Alert>
      );
  }
}
