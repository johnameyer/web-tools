import { AppShell, Anchor, Container, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';

import { tools } from './tools';

function Home() {
  return (
    <Stack>
      <Title order={2}>Tools</Title>
      {tools.length === 0 && <Text c="dimmed">No tools yet.</Text>}
      {tools.map(tool => (
        <div key={tool.path}>
          <Anchor component={Link} to={tool.path}>{tool.title}</Anchor>
          <Text size="sm" c="dimmed">{tool.description}</Text>
        </div>
      ))}
    </Stack>
  );
}

// HashRouter so deep links work on static hosting without a 404 fallback
export function App(): ReactElement {
  return (
    <HashRouter>
      <AppShell header={{ height: 56 }} padding="md">
        <AppShell.Header p="md">
          <Anchor component={Link} to="/" fw={700} underline="never">web-tools</Anchor>
        </AppShell.Header>
        <AppShell.Main>
          <Container size="md">
            <Routes>
              <Route path="/" element={<Home />} />
              {tools.map(tool => (
                <Route key={tool.path} path={tool.path} element={<tool.component />} />
              ))}
            </Routes>
          </Container>
        </AppShell.Main>
      </AppShell>
    </HashRouter>
  );
}
