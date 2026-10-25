import { describe, expect, it } from 'vitest';

import { formatJson, formatText, parseJson, sortKeysDeep } from './json';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ ok: true, value: { a: [ 1, 2 ] }});
  });

  it('reports failure with a message', () => {
    const result = parseJson('{"a": }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toBe('');
    }
  });

  it('rejects empty input', () => {
    expect(parseJson('').ok).toBe(false);
  });

  it('rejects trailing commas', () => {
    expect(parseJson('[1,2,]').ok).toBe(false);
  });
});

describe('formatJson', () => {
  const value = { b: 1, a: { d: [ 3, { z: 1, y: 2 }], c: null }};

  it('indents with spaces', () => {
    expect(formatJson({ a: [ 1 ] }, { indent: 2, sortKeys: false })).toBe('{\n  "a": [\n    1\n  ]\n}');
  });

  it('indents with tabs', () => {
    expect(formatJson({ a: 1 }, { indent: 'tab', sortKeys: false })).toBe('{\n\t"a": 1\n}');
  });

  it('minifies when indent is 0', () => {
    expect(formatJson(value, { indent: 0, sortKeys: false })).toBe('{"b":1,"a":{"d":[3,{"z":1,"y":2}],"c":null}}');
  });

  it('sorts keys recursively, including inside arrays', () => {
    expect(formatJson(value, { indent: 0, sortKeys: true })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it('does not mutate the input when sorting', () => {
    const input = { b: 1, a: 2 };
    sortKeysDeep(input);
    expect(Object.keys(input)).toEqual([ 'b', 'a' ]);
  });
});

describe('formatText', () => {
  it('formats valid text', () => {
    expect(formatText('{"a":1}', { indent: 2, sortKeys: false })).toEqual({ ok: true, text: '{\n  "a": 1\n}' });
  });

  it('minifies valid text', () => {
    expect(formatText('{\n  "a": [ 1, 2 ]\n}', { indent: 0, sortKeys: false })).toEqual({ ok: true, text: '{"a":[1,2]}' });
  });

  it('returns the error for invalid text', () => {
    const result = formatText('{"a":', { indent: 2, sortKeys: false });
    expect(result.ok).toBe(false);
  });
});
