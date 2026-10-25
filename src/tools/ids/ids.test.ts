// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createUlidGenerator, createUuidV7Generator, parseId, ulidToUuid, uuidToUlid, uuidV4 } from './ids';
import type { RandomBytes } from './ids';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// 2022-02-22T19:22:22.000Z, the instant used in the RFC 9562 examples
const RFC_INSTANT = 1645557742000;

/** Deterministic randomness: each call returns bytes counting up from a seed. */
function fixedRandom(fill: number): RandomBytes {
  return length => new Uint8Array(length).fill(fill);
}

describe('uuidV4', () => {
  it('sets version 4 and the RFC variant', () => {
    for (let i = 0; i < 50; i++) {
      const id = uuidV4();
      expect(id).toMatch(UUID_PATTERN);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
  });

  it('produces distinct values', () => {
    expect(new Set(Array.from({ length: 100 }, () => uuidV4())).size).toBe(100);
  });
});

describe('createUuidV7Generator', () => {
  it('encodes the timestamp, version and variant', () => {
    const id = createUuidV7Generator(fixedRandom(0xab))(RFC_INSTANT);
    expect(id).toMatch(UUID_PATTERN);
    expect(id.startsWith('017f22e2-79b0-7')).toBe(true);
    expect('89ab').toContain(id[19]);
  });

  it('sorts in creation order, including within one millisecond', () => {
    const next = createUuidV7Generator();
    const ids = [ ...Array.from({ length: 200 }, () => next(RFC_INSTANT)), next(RFC_INSTANT + 1), next(RFC_INSTANT + 5) ];
    expect([ ...ids ].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('borrows the next millisecond when the counter overflows, and never goes backwards', () => {
    const next = createUuidV7Generator(fixedRandom(0xff));
    const ids = Array.from({ length: 5000 }, () => next(RFC_INSTANT));
    expect([ ...ids ].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect(next(RFC_INSTANT - 1000) > ids[ids.length - 1]).toBe(true);
  });
});

describe('createUlidGenerator', () => {
  it('produces 26 Crockford characters whose timestamp round-trips', () => {
    const id = createUlidGenerator()(RFC_INSTANT);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(parseId(id).timestamp?.getTime()).toBe(RFC_INSTANT);
  });

  it('sorts in creation order and increments within a millisecond', () => {
    const next = createUlidGenerator();
    const ids = [ ...Array.from({ length: 200 }, () => next(RFC_INSTANT)), next(RFC_INSTANT + 1) ];
    expect([ ...ids ].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rolls into the next millisecond if the random part is exhausted', () => {
    const next = createUlidGenerator(fixedRandom(0xff));
    const first = next(RFC_INSTANT);
    const second = next(RFC_INSTANT);
    expect(first.slice(10)).toBe('ZZZZZZZZZZZZZZZZ');
    expect(parseId(second).timestamp?.getTime()).toBe(RFC_INSTANT + 1);
    expect(second > first).toBe(true);
  });
});

describe('parseId on UUIDs', () => {
  it('reads the RFC 9562 version 1 example', () => {
    const details = parseId('C232AB00-9414-11EC-B3C8-9F6BDECED846');
    expect(details.type).toBe('UUID version 1 (time-based)');
    expect(details.timestamp?.getTime()).toBe(RFC_INSTANT);
    expect(details.uuid).toBe('c232ab00-9414-11ec-b3c8-9f6bdeced846');
  });

  it('reads the RFC 9562 version 6 example', () => {
    const details = parseId('1EC9414C-232A-6B00-B3C8-9F6BDECED846');
    expect(details.type).toBe('UUID version 6 (reordered time-based)');
    expect(details.timestamp?.getTime()).toBe(RFC_INSTANT);
  });

  it('reads the RFC 9562 version 7 example', () => {
    const details = parseId('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
    expect(details.type).toBe('UUID version 7 (time-ordered)');
    expect(details.variant).toBe('RFC 9562 (standard)');
    expect(details.timestamp?.getTime()).toBe(RFC_INSTANT);
  });

  it('has no timestamp for random or name-based versions', () => {
    expect(parseId(uuidV4()).type).toBe('UUID version 4 (random)');
    expect(parseId(uuidV4()).timestamp).toBeUndefined();
    expect(parseId('6ba7b810-9dad-11d1-80b4-00c04fd430c8').timestamp?.getFullYear()).toBe(1998);
    expect(parseId('3d813cbb-47fb-32ba-91df-831e1593ac29').type).toBe('UUID version 3 (MD5 name-based)');
  });

  it('recognizes nil and max UUIDs', () => {
    expect(parseId('00000000-0000-0000-0000-000000000000').type).toContain('Nil');
    expect(parseId('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF').type).toContain('Max');
  });

  it('accepts plain, braced and urn forms', () => {
    const expected = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
    expect(parseId('017f22e279b07cc398c4dc0c0c07398f').uuid).toBe(expected);
    expect(parseId('{017f22e2-79b0-7cc3-98c4-dc0c0c07398f}').uuid).toBe(expected);
    expect(parseId('urn:uuid:017f22e2-79b0-7cc3-98c4-dc0c0c07398f').uuid).toBe(expected);
  });

  it('flags non-standard variants instead of guessing a version', () => {
    const details = parseId('017f22e2-79b0-7cc3-18c4-dc0c0c07398f');
    expect(details.type).toContain('unrecognized');
    expect(details.timestamp).toBeUndefined();
  });

  it('rejects malformed input', () => {
    expect(() => parseId('')).toThrow('Enter a UUID or ULID');
    expect(() => parseId('not-an-id')).toThrow('Not a UUID');
    expect(() => parseId('017f22e2-79b07cc3-98c4-dc0c0c07398f')).toThrow('Not a UUID');
    expect(() => parseId('017f22e2-79b0-7cc3-98c4-dc0c0c07398')).toThrow('Not a UUID');
  });
});

describe('parseId on ULIDs', () => {
  it('reads the timestamp from the ULID spec example', () => {
    const details = parseId('01ARYZ6S41TSV4RRFFQ69G5FAV');
    expect(details.kind).toBe('ULID');
    expect(details.timestamp?.getTime()).toBe(1469918176385);
  });

  it('is case-insensitive and normalizes to uppercase', () => {
    expect(parseId('01aryz6s41tsv4rrffq69g5fav').ulid).toBe('01ARYZ6S41TSV4RRFFQ69G5FAV');
  });

  it('rejects overflow and characters outside the alphabet', () => {
    expect(() => parseId('80000000000000000000000000')).toThrow('too large');
    expect(() => parseId('01ARYZ6S41TSV4RRFFQ69G5FAU')).toThrow('Not a UUID');
  });
});

describe('UUID and ULID conversion', () => {
  it('round-trips both ways', () => {
    const uuid = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
    expect(ulidToUuid(uuidToUlid(uuid))).toBe(uuid);
    const ulid = '01ARYZ6S41TSV4RRFFQ69G5FAV';
    expect(uuidToUlid(ulidToUuid(ulid))).toBe(ulid);
  });

  it('keeps the ULID timestamp identical to the UUIDv7 timestamp', () => {
    const uuid = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
    expect(parseId(uuidToUlid(uuid)).timestamp?.getTime()).toBe(RFC_INSTANT);
  });

  it('maps nil and max correctly', () => {
    expect(uuidToUlid('00000000-0000-0000-0000-000000000000')).toBe('00000000000000000000000000');
    expect(uuidToUlid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe('7ZZZZZZZZZZZZZZZZZZZZZZZZZ');
  });
});
