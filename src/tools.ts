import type { ComponentType } from 'react';

import { Base64Tool } from './tools/base64/Base64Tool';

export interface Tool {
  path: string;
  title: string;
  description: string;
  component: ComponentType;
}

// Register new tools here; the home page and router are generated from this list.
export const tools: Tool[] = [
  {
    path: 'base64',
    title: 'Base64 encode / decode',
    description: 'Encode and decode Base64, standard or URL-safe',
    component: Base64Tool,
  },
];
