import type { ComponentType } from 'react';

export interface Tool {
  path: string;
  title: string;
  description: string;
  component: ComponentType;
}

// Register new tools here; the home page and router are generated from this list.
export const tools: Tool[] = [];
