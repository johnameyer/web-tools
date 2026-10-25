import { describe, expect, it } from 'vitest';

import { decodeUri, encodeUri } from './uri';

describe('encodeUri', () => {
  it('escapes reserved characters in component mode', () => {
    expect(encodeUri('a b&c=d/e?f#g', 'component')).toBe('a%20b%26c%3Dd%2Fe%3Ff%23g');
  });

  it('keeps reserved characters in full mode', () => {
    expect(encodeUri('https://example.com/a b?q=1&r=é#top', 'full')).toBe('https://example.com/a%20b?q=1&r=%C3%A9#top');
  });

  it('encodes non-ASCII as UTF-8', () => {
    expect(encodeUri('héllo ✓', 'component')).toBe('h%C3%A9llo%20%E2%9C%93');
  });

  it('encodes empty input', () => {
    expect(encodeUri('', 'component')).toBe('');
  });
});

describe('decodeUri', () => {
  it('decodes component escapes', () => {
    expect(decodeUri('a%20b%26c%3Dd%2Fe', 'component')).toBe('a b&c=d/e');
  });

  it('leaves reserved escapes intact in full mode', () => {
    expect(decodeUri('https://example.com/a%20b?q=1%262', 'full')).toBe('https://example.com/a b?q=1%262');
  });

  it('does not treat + as a space', () => {
    expect(decodeUri('a+b', 'component')).toBe('a+b');
  });

  it('round-trips', () => {
    const text = 'k=v&x=ü/ü?🎉';
    expect(decodeUri(encodeUri(text, 'component'), 'component')).toBe(text);
  });

  it('throws on malformed escapes', () => {
    expect(() => decodeUri('%E0%A4%A', 'component')).toThrow('malformed percent-escape');
  });
});
