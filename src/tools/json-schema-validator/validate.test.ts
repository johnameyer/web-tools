import { describe, expect, it } from 'vitest';

import { validateAgainstSchema } from './validate';

const schema = JSON.stringify({
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer', minimum: 0 },
    email: { type: 'string', format: 'email' },
  },
  required: [ 'name' ],
});

describe('validateAgainstSchema', () => {
  it('accepts valid data', () => {
    expect(validateAgainstSchema(schema, '{"name":"Ann","age":3}', '2020-12')).toEqual({ status: 'valid' });
  });

  it('reports every issue with its path', () => {
    const result = validateAgainstSchema(schema, '{"age":-1,"email":"nope"}', '2020-12');
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.issues.map(i => [ i.path, i.keyword ])).toEqual(expect.arrayContaining([
        [ '', 'required' ],
        [ '/age', 'minimum' ],
        [ '/email', 'format' ],
      ]));
    }
  });

  it('flags unparseable data', () => {
    expect(validateAgainstSchema(schema, '{', '2020-12')).toMatchObject({ status: 'error', source: 'data' });
  });

  it('flags unparseable schema', () => {
    expect(validateAgainstSchema('{', '{}', '2020-12')).toMatchObject({ status: 'error', source: 'schema' });
  });

  it('flags a schema that cannot compile', () => {
    expect(validateAgainstSchema('{"type":"nonsense"}', '1', '2020-12')).toMatchObject({ status: 'error', source: 'schema' });
  });

  it('supports each draft', () => {
    const draft07 = '{"$schema":"http://json-schema.org/draft-07/schema#","type":"string"}';
    expect(validateAgainstSchema(draft07, '"x"', 'draft-07')).toEqual({ status: 'valid' });
    expect(validateAgainstSchema('{"type":"string"}', '1', '2019-09').status).toBe('invalid');
  });
});
