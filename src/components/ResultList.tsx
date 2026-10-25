import { Box, Button, CopyButton, Flex, Paper, Text } from '@mantine/core';
import type { ReactElement } from 'react';

export interface ResultRow {
  label: string;
  value: string;
  /** Secondary text under the value that is not copied, such as a relative time */
  note?: string;
}

/**
 * Labeled values with a copy button each. Rows sit side by side on wide screens and stack
 * (label above value) on narrow ones, so long values such as hashes keep the full width.
 */
export function ResultList({ rows }: { rows: ResultRow[] }): ReactElement {
  return (
    <Paper withBorder component="dl" m={0}>
      {rows.map((row, index) => (
        <Flex
          key={row.label}
          direction={{ base: 'column', sm: 'row' }}
          gap={{ base: 4, sm: 'md' }}
          align={{ base: 'stretch', sm: 'center' }}
          p="sm"
          style={{ borderTop: index > 0 ? '1px solid var(--mantine-color-default-border)' : undefined }}
        >
          <Text component="dt" fw={600} size="sm" w={{ base: 'auto', sm: 190 }} style={{ flexShrink: 0 }}>{row.label}</Text>
          <Box component="dd" m={0} style={{ flex: 1, minWidth: 0 }}>
            <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all' }}>{row.value}</Text>
            {row.note && <Text size="sm" c="dimmed">{row.note}</Text>}
          </Box>
          <CopyButton value={row.value}>
            {({ copied, copy }) => (
              <Button size="compact-sm" variant="subtle" onClick={copy} aria-label={`Copy ${row.label}`} style={{ alignSelf: 'flex-start', flexShrink: 0 }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </CopyButton>
        </Flex>
      ))}
    </Paper>
  );
}
