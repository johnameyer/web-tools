import type { ComponentType } from 'react';

import { Base64Tool } from './tools/base64/Base64Tool';
import { UriTool } from './tools/uri/UriTool';

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
  {
    path: 'uri',
    title: 'URI encode / decode',
    description: 'Percent-encode and decode URI components or full URIs',
    component: UriTool,
  },
];
