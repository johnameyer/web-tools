// @vitest-environment node
import { createHash, createHmac, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ALGORITHMS, digest, encodeBytes, hashAll, hmac, md5 } from './hash';

const utf8 = (text: string) => new TextEncoder().encode(text);
const hex = (bytes: Uint8Array) => encodeBytes(bytes, 'hex');

describe('md5', () => {
  // RFC 1321 appendix A.5
  const vectors: [ string, string ][] = [
    [ '', 'd41d8cd98f00b204e9800998ecf8427e' ],
    [ 'a', '0cc175b9c0f1b6a831c399e269772661' ],
    [ 'abc', '900150983cd24fb0d6963f7d28e17f72' ],
    [ 'message digest', 'f96b697d7cb7938d525a2f31aaf161d0' ],
    [ 'abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b' ],
    [ 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f' ],
    [ '12345678901234567890123456789012345678901234567890123456789012345678901234567890', '57edf4a22be3c955ac49da2e2107b67a' ],
  ];

  it.each(vectors)('matches the RFC 1321 vector for %j', (input, expected) => {
    expect(hex(md5(utf8(input)))).toBe(expected);
  });

  it('matches Node for every length across the padding boundaries', () => {
    for (let length = 0; length <= 200; length++) {
      const data = randomBytes(length);
      expect(hex(md5(data))).toBe(createHash('md5').update(data)
        .digest('hex'));
    }
  });

  it('handles multi-block input and all byte values', () => {
    const data = Uint8Array.from({ length: 5000 }, (_, i) => i % 256);
    expect(hex(md5(data))).toBe(createHash('md5').update(data)
      .digest('hex'));
  });
});

describe('digest', () => {
  it.each(ALGORITHMS)('%s matches Node', async algorithm => {
    const data = utf8('héllo ✓');
    expect(hex(await digest(algorithm, data))).toBe(createHash(algorithm.toLowerCase().replace('-', '')).update(data)
      .digest('hex'));
  });

  it('matches the well-known SHA-256 of "abc"', async () => {
    expect(hex(await digest('SHA-256', utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('hmac', () => {
  it('matches RFC 4231 test case 2 for SHA-256', async () => {
    expect(hex(await hmac('SHA-256', utf8('Jefe'), utf8('what do ya want for nothing?'))))
      .toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('matches RFC 2202 test case 2 for MD5', async () => {
    expect(hex(await hmac('MD5', utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe('750c783e6ab0b503eaa86e310a5db738');
  });

  it.each(ALGORITHMS)('%s matches Node for short, block-sized and oversized keys', async algorithm => {
    const data = utf8('payload');
    for (const keyLength of [ 0, 1, 20, 64, 65, 128, 129, 300 ]) {
      const key = randomBytes(keyLength);
      expect(hex(await hmac(algorithm, key, data))).toBe(createHmac(algorithm.toLowerCase().replace('-', ''), key).update(data)
        .digest('hex'));
    }
  });
});

describe('encodeBytes', () => {
  const bytes = Uint8Array.from([ 0, 15, 255, 171 ]);

  it('encodes hex in either case and base64', () => {
    expect(encodeBytes(bytes, 'hex')).toBe('000fffab');
    expect(encodeBytes(bytes, 'HEX')).toBe('000FFFAB');
    expect(encodeBytes(bytes, 'base64')).toBe('AA//qw==');
  });
});

describe('hashAll', () => {
  it('returns every algorithm, and HMACs when given a key', async () => {
    const plain = await hashAll(utf8('abc'));
    expect(Object.keys(plain)).toEqual([ ...ALGORITHMS ]);
    expect(hex(plain.MD5)).toBe('900150983cd24fb0d6963f7d28e17f72');

    const keyed = await hashAll(utf8('abc'), utf8('k'));
    expect(hex(keyed['SHA-256'])).toBe(createHmac('sha256', 'k').update('abc')
      .digest('hex'));
  });
});
