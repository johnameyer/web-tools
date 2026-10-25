import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export type Draft = '2020-12' | '2019-09' | 'draft-07';

export interface ValidationIssue {
  /** JSON Pointer to the failing value; empty string is the document root */
  path: string;
  message: string;
  keyword: string;
}

export type ValidationResult =
  | { status: 'valid' }
  | { status: 'invalid'; issues: ValidationIssue[] }
  | { status: 'error'; source: 'schema' | 'data'; message: string };

function createAjv(draft: Draft): Ajv {
  // strict is off: this is a scratchpad, so unknown keywords shouldn't be fatal
  const options = { allErrors: true, strict: false };
  const ajv = draft === '2020-12' ? new Ajv2020(options) : draft === '2019-09' ? new Ajv2019(options) : new Ajv(options);
  addFormats(ajv);
  return ajv;
}

function parse(text: string, source: 'schema' | 'data'): { value: unknown } | { error: ValidationResult } {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    return { error: { status: 'error', source, message: `${source === 'schema' ? 'Schema' : 'Data'} is not valid JSON: ${message}` }};
  }
}

export function validateAgainstSchema(schemaText: string, dataText: string, draft: Draft): ValidationResult {
  const schema = parse(schemaText, 'schema');
  if ('error' in schema) {
    return schema.error;
  }
  const data = parse(dataText, 'data');
  if ('error' in data) {
    return data.error;
  }

  let validate;
  try {
    validate = createAjv(draft).compile(schema.value as object);
  } catch (e) {
    return { status: 'error', source: 'schema', message: e instanceof Error ? e.message : 'Schema could not be compiled' };
  }

  if (validate(data.value)) {
    return { status: 'valid' };
  }
  return {
    status: 'invalid',
    issues: (validate.errors ?? []).map(error => ({
      path: error.instancePath,
      message: error.message ?? 'is invalid',
      keyword: error.keyword,
    })),
  };
}
