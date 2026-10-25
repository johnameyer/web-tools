import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import type { ReactElement } from 'react';

function Icon({ dark }: { dark: boolean }): ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      ) : (
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      )}
    </svg>
  );
}

/** Switches between light and dark. Starts from the system setting, and remembers an explicit choice. */
export function ThemeToggle(): ReactElement {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: false });
  const isDark = computed === 'dark';

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      <Icon dark={isDark} />
    </ActionIcon>
  );
}
