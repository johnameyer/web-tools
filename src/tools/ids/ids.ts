const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** 100ns ticks between the UUID epoch (1582-10-15) and the Unix epoch. */
const GREGORIAN_OFFSET_TICKS = 122192928000000000n;

export type RandomBytes = (length: number) => Uint8Array;

export const secureRandom: RandomBytes = length => crypto.getRandomValues(new Uint8Array(length));

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hyphenate(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function uuidV4(random: RandomBytes = secureRandom): string {
  const bytes = random(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return hyphenate(toHex(bytes));
}

export type IdGenerator = (nowMs: number) => string;

/**
 * UUIDv7 (RFC 9562): 48-bit millisecond timestamp, then a 12-bit counter and 62 random bits.
 * IDs from one generator sort in creation order even within the same millisecond, because the
 * counter increments (borrowing the next millisecond if it overflows).
 */
export function createUuidV7Generator(random: RandomBytes = secureRandom): IdGenerator {
  let lastMs = -1;
  let counter = 0;
  return nowMs => {
    const seed = random(10);
    if (nowMs > lastMs) {
      lastMs = nowMs;
      // Start below the top of the range so a burst has room to count up
      counter = ((seed[8] << 8) | seed[9]) & 0x7ff;
    } else {
      counter++;
      if (counter > 0xfff) {
        lastMs++;
        counter = ((seed[8] << 8) | seed[9]) & 0x7ff;
      }
    }
    const bytes = new Uint8Array(16);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(lastMs) << 16n);
    bytes[6] = 0x70 | (counter >> 8);
    bytes[7] = counter & 0xff;
    bytes.set(seed.subarray(0, 8), 8);
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return hyphenate(toHex(bytes));
  };
}

function encodeCrockford(value: bigint, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result = CROCKFORD[Number(value & 31n)] + result;
    value >>= 5n;
  }
  return result;
}

/**
 * ULID: 48-bit millisecond timestamp and 80 random bits in Crockford base32. Within one
 * millisecond the random part is incremented, so output stays sorted (per the ULID spec).
 */
export function createUlidGenerator(random: RandomBytes = secureRandom): IdGenerator {
  let lastMs = -1;
  let lastRandom = 0n;
  return nowMs => {
    const fresh = BigInt(`0x${toHex(random(10))}`);
    if (nowMs > lastMs) {
      lastMs = nowMs;
      lastRandom = fresh;
    } else if (lastRandom + 1n < 1n << 80n) {
      lastRandom += 1n;
    } else {
      lastMs++;
      lastRandom = fresh;
    }
    return encodeCrockford(BigInt(lastMs), 10) + encodeCrockford(lastRandom, 16);
  };
}

function decodeCrockford(text: string): bigint {
  let value = 0n;
  for (const char of text.toUpperCase()) {
    value = (value << 5n) | BigInt(CROCKFORD.indexOf(char));
  }
  return value;
}

export function uuidToUlid(uuid: string): string {
  return encodeCrockford(BigInt(`0x${uuid.replace(/-/g, '')}`), 26);
}

export function ulidToUuid(ulid: string): string {
  return hyphenate(decodeCrockford(ulid).toString(16)
    .padStart(32, '0'));
}

export interface IdDetails {
  kind: 'UUID' | 'ULID';
  /** Short description such as "UUID version 7 (time-ordered)" */
  type: string;
  variant?: string;
  timestamp?: Date;
  /** Canonical lowercase hyphenated UUID form (a ULID's 128 bits shown as a UUID) */
  uuid: string;
  ulid: string;
  /** For ULIDs, the 80 random bits as hex */
  randomHex?: string;
}

const VERSION_NAMES: Record<number, string> = {
  1: 'time-based',
  2: 'DCE security',
  3: 'MD5 name-based',
  4: 'random',
  5: 'SHA-1 name-based',
  6: 'reordered time-based',
  7: 'time-ordered',
  8: 'custom',
};

function variantName(nibble: number): string {
  if (nibble < 8) {
    return 'NCS backward compatibility (reserved)';
  }
  if (nibble < 12) {
    return 'RFC 9562 (standard)';
  }
  return nibble < 14 ? 'Microsoft backward compatibility (reserved)' : 'Reserved for the future';
}

function ticksToDate(ticks: bigint): Date | undefined {
  const date = new Date(Number((ticks - GREGORIAN_OFFSET_TICKS) / 10000n));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function uuidTimestamp(hex: string, version: number): Date | undefined {
  if (version === 1) {
    return ticksToDate(BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`));
  }
  if (version === 6) {
    return ticksToDate(BigInt(`0x${hex.slice(0, 8)}${hex.slice(8, 12)}${hex.slice(13, 16)}`));
  }
  if (version === 7) {
    return new Date(parseInt(hex.slice(0, 12), 16));
  }
  return undefined;
}

/** Accepts a UUID (hyphenated, plain, braced or `urn:uuid:`) or a ULID. Throws a user-facing Error otherwise. */
export function parseId(input: string): IdDetails {
  const text = input.trim().replace(/^urn:uuid:/i, '')
    .replace(/^\{(.*)\}$/, '$1');
  if (!text) {
    throw new Error('Enter a UUID or ULID');
  }

  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(text)) {
    if (text[0] > '7') {
      throw new Error('This ULID is too large: its first character must be 0-7');
    }
    const uuid = ulidToUuid(text);
    return {
      kind: 'ULID',
      type: 'ULID',
      timestamp: new Date(Number(decodeCrockford(text.slice(0, 10)))),
      uuid,
      ulid: text.toUpperCase(),
      randomHex: uuid.replace(/-/g, '').slice(12),
    };
  }

  const hex = /^[0-9a-f]{8}(-?)[0-9a-f]{4}\1[0-9a-f]{4}\1[0-9a-f]{4}\1[0-9a-f]{12}$/i.test(text) ? text.replace(/-/g, '').toLowerCase() : undefined;
  if (!hex) {
    throw new Error('Not a UUID (32 hex digits, optionally hyphenated 8-4-4-4-12) or a ULID (26 characters)');
  }

  const uuid = hyphenate(hex);
  const ulid = uuidToUlid(uuid);
  if (/^0+$/.test(hex)) {
    return { kind: 'UUID', type: 'Nil UUID (all zeros)', uuid, ulid };
  }
  if (/^f+$/.test(hex)) {
    return { kind: 'UUID', type: 'Max UUID (all ones)', uuid, ulid };
  }
  const version = parseInt(hex[12], 16);
  const variantNibble = parseInt(hex[16], 16);
  const isStandard = variantNibble >= 8 && variantNibble < 12;
  const name = VERSION_NAMES[version];
  return {
    kind: 'UUID',
    type: isStandard && name ? `UUID version ${version} (${name})` : `UUID with unrecognized version ${version}`,
    variant: variantName(variantNibble),
    timestamp: isStandard ? uuidTimestamp(hex, version) : undefined,
    uuid,
    ulid,
  };
}
