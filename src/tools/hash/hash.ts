export const ALGORITHMS = [ 'MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512' ] as const;
export type HashAlgorithm = typeof ALGORITHMS[number];

/** HMAC block size in bytes (RFC 2104): 128 for the SHA-384/512 family, 64 otherwise. */
const BLOCK_SIZE: Record<HashAlgorithm, number> = {
  MD5: 64,
  'SHA-1': 64,
  'SHA-256': 64,
  'SHA-384': 128,
  'SHA-512': 128,
};

const MD5_SHIFTS = [
  ...Array<number[]>(4).fill([ 7, 12, 17, 22 ])
    .flat(),
  ...Array<number[]>(4).fill([ 5, 9, 14, 20 ])
    .flat(),
  ...Array<number[]>(4).fill([ 4, 11, 16, 23 ])
    .flat(),
  ...Array<number[]>(4).fill([ 6, 10, 15, 21 ])
    .flat(),
];
const MD5_CONSTANTS = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

/** WebCrypto has no MD5, so this implements RFC 1321. */
export function md5(data: Uint8Array): Uint8Array {
  const blocks = Math.floor((data.length + 8) / 64) + 1;
  const padded = new Uint8Array(blocks * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  // Message length in bits as a 64-bit little-endian integer
  view.setUint32(padded.length - 8, (data.length << 3) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(data.length / 2 ** 29), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, i) => view.getUint32(offset + i * 4, true));
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + MD5_CONSTANTS[i] + words[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((f << MD5_SHIFTS[i]) | (f >>> (32 - MD5_SHIFTS[i])))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [ a0, b0, c0, d0 ].forEach((word, i) => outView.setUint32(i * 4, word, true));
  return out;
}

export async function digest(algorithm: HashAlgorithm, data: Uint8Array): Promise<Uint8Array> {
  if (algorithm === 'MD5') {
    return md5(data);
  }
  return new Uint8Array(await crypto.subtle.digest(algorithm, data as BufferSource));
}

/**
 * HMAC per RFC 2104, built on `digest` for every algorithm. WebCrypto's HMAC refuses empty keys,
 * which are valid, and cannot do MD5, so one implementation keeps the behavior uniform.
 */
export async function hmac(algorithm: HashAlgorithm, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const blockSize = BLOCK_SIZE[algorithm];
  const normalizedKey = key.length > blockSize ? await digest(algorithm, key) : key;
  const inner = new Uint8Array(blockSize + data.length);
  const outerPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    const keyByte = normalizedKey[i] ?? 0;
    inner[i] = keyByte ^ 0x36;
    outerPad[i] = keyByte ^ 0x5c;
  }
  inner.set(data, blockSize);
  const innerHash = await digest(algorithm, inner);
  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(outerPad);
  outer.set(innerHash, blockSize);
  return digest(algorithm, outer);
}

export type OutputFormat = 'hex' | 'HEX' | 'base64';

export function encodeBytes(bytes: Uint8Array, format: OutputFormat): string {
  if (format === 'base64') {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return format === 'HEX' ? hex.toUpperCase() : hex;
}

export type HashResults = Record<HashAlgorithm, Uint8Array>;

/** Hashes (or HMACs, when `key` is given) the data with every supported algorithm. */
export async function hashAll(data: Uint8Array, key?: Uint8Array): Promise<HashResults> {
  const entries = await Promise.all(
    ALGORITHMS.map(async algorithm => [ algorithm, key ? await hmac(algorithm, key, data) : await digest(algorithm, data) ] as const),
  );
  return Object.fromEntries(entries) as HashResults;
}
