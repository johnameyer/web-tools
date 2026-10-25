import { AppShell, Anchor, Burger, Container, Group, Loader, NavLink, Stack, Text, Title } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Suspense } from 'react';
import type { ReactElement } from 'react';
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';

import { ThemeToggle } from './components/ThemeToggle';
import { tools } from './tools';

function Home(): ReactElement {
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

function Shell(): ReactElement {
  const [ navOpened, { toggle, close }] = useDisclosure(false);
  const { pathname } = useLocation();
  // Matches the navbar breakpoint ('sm' = 48em); below it the navbar slides off-screen when closed
  const isMobile = useMediaQuery('(max-width: 47.99em)', false, { getInitialValueInEffect: false });

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !navOpened }}}
      padding="md"
    >
      <AppShell.Header p="md">
        <Group h="100%" justify="space-between">
          <Group>
            <Burger opened={navOpened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Anchor component={Link} to="/" fw={700} underline="never">web-tools</Anchor>
          </Group>
          <ThemeToggle />
        </Group>
      </AppShell.Header>
      {/* inert keeps the off-screen links out of the tab order and the accessibility tree */}
      <AppShell.Navbar p="xs" aria-label="Tools" inert={isMobile && !navOpened}>
        <AppShell.Section grow style={{ overflowY: 'auto' }}>
          <NavLink component={Link} to="/" label="Home" active={pathname === '/'} onClick={close} />
          {tools.map(tool => (
            <NavLink
              key={tool.path}
              component={Link}
              to={tool.path}
              label={tool.title}
              active={pathname === `/${tool.path}`}
              onClick={close}
            />
          ))}
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        <Container size="lg">
          <Suspense fallback={<Loader aria-label="Loading tool" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              {tools.map(tool => (
                <Route key={tool.path} path={tool.path} element={<tool.component />} />
              ))}
            </Routes>
          </Suspense>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

// HashRouter so deep links work on static hosting without a 404 fallback
export function App(): ReactElement {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
