import { describe, expect, it } from 'vitest';

import { decodeBase64, encodeBase64 } from './base64';

describe('encodeBase64', () => {
  it('encodes ASCII', () => {
    expect(encodeBase64('hello world')).toBe('aGVsbG8gd29ybGQ=');
  });

  it('encodes non-ASCII as UTF-8', () => {
    expect(encodeBase64('héllo ✓')).toBe('aMOpbGxvIOKckw==');
  });

  it('encodes empty input', () => {
    expect(encodeBase64('')).toBe('');
  });

  it('uses the URL-safe alphabet without padding', () => {
    expect(encodeBase64('??>>', false)).toBe('Pz8+Pg==');
    expect(encodeBase64('??>>', true)).toBe('Pz8-Pg');
  });
});

describe('decodeBase64', () => {
  it('decodes standard input', () => {
    expect(decodeBase64('aGVsbG8gd29ybGQ=')).toBe('hello world');
  });

  it('decodes UTF-8', () => {
    expect(decodeBase64('aMOpbGxvIOKckw==')).toBe('héllo ✓');
  });

  it('decodes URL-safe input without padding', () => {
    expect(decodeBase64('Pz8-Pg')).toBe('??>>');
  });

  it('ignores whitespace and line breaks', () => {
    expect(decodeBase64('aGVs\nbG8g d29y\r\nbGQ=')).toBe('hello world');
  });

  it('round-trips', () => {
    const text = 'Line 1\nLine 2 — “quoted” 🎉';
    expect(decodeBase64(encodeBase64(text, true))).toBe(text);
    expect(decodeBase64(encodeBase64(text, false))).toBe(text);
  });

  it('throws on invalid Base64', () => {
    expect(() => decodeBase64('not*base64!')).toThrow('not valid Base64');
  });

  it('throws when bytes are not UTF-8', () => {
    expect(() => decodeBase64('/w==')).toThrow('not valid UTF-8');
  });
});
