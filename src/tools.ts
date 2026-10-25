import { lazy } from 'react';
import type { ComponentType } from 'react';

export interface Tool {
  path: string;
  title: string;
  description: string;
  component: ComponentType;
}

// Each tool is lazy-loaded so its dependencies only download when the tool is opened.
function load(importer: () => Promise<Record<string, ComponentType>>, name: string): ComponentType {
  return lazy(async () => ({ default: (await importer())[name] }));
}

// Register new tools here; the home page and router are generated from this list.
export const tools: Tool[] = [
  {
    path: 'base64',
    title: 'Base64 encode / decode',
    description: 'Encode and decode Base64, standard or URL-safe',
    component: load(() => import('./tools/base64/Base64Tool'), 'Base64Tool'),
  },
  {
    path: 'uri',
    title: 'URI encode / decode',
    description: 'Percent-encode and decode URI components or full URIs',
    component: load(() => import('./tools/uri/UriTool'), 'UriTool'),
  },
  {
    path: 'json-format',
    title: 'JSON prettify / minify',
    description: 'Format, minify, sort, fold and validate JSON',
    component: load(() => import('./tools/json-format/JsonFormatTool'), 'JsonFormatTool'),
  },
  {
    path: 'json-schema-editor',
    title: 'JSON Schema editor',
    description: 'Write a JSON Schema with keyword hints and test it against sample data',
    component: load(() => import('./tools/json-schema-editor/JsonSchemaEditorTool'), 'JsonSchemaEditorTool'),
  },
  {
    path: 'json-schema-validator',
    title: 'JSON Schema validator',
    description: 'Validate JSON data against a JSON Schema',
    component: load(() => import('./tools/json-schema-validator/JsonSchemaValidatorTool'), 'JsonSchemaValidatorTool'),
  },
];
