// @vitest-environment node
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decodeJwt, keyKindFor, timeClaims, tokenStatus, verifyJwt } from './jwt';

function b64url(input: string | Uint8Array): string {
  return Buffer.from(input).toString('base64url');
}

function unsigned(header: object, payload: object): string {
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
}

function hs256(payload: object, secret: string): string {
  const input = unsigned({ alg: 'HS256', typ: 'JWT' }, payload);
  return `${input}.${createHmac('sha256', secret).update(input)
    .digest('base64url')}`;
}

describe('decodeJwt', () => {
  it('decodes header and payload', () => {
    const jwt = decodeJwt(hs256({ sub: '123', name: 'Ada ✓' }, 'secret'));
    expect(jwt.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(jwt.payload).toEqual({ sub: '123', name: 'Ada ✓' });
    expect(jwt.signingInput.split('.')).toHaveLength(2);
  });

  it('accepts a Bearer prefix, whitespace and line breaks', () => {
    const token = hs256({ a: 1 }, 's');
    const wrapped = `Bearer ${token.slice(0, 20)}\n${token.slice(20)}  `;
    expect(decodeJwt(wrapped).payload).toEqual({ a: 1 });
  });

  it('rejects empty input and wrong segment counts', () => {
    expect(() => decodeJwt('  ')).toThrow('Paste a JWT');
    expect(() => decodeJwt('a.b')).toThrow('3 dot-separated parts, but this has 2');
  });

  it('explains encrypted tokens', () => {
    expect(() => decodeJwt('a.b.c.d.e')).toThrow('encrypted');
  });

  it('rejects segments that are not JSON objects', () => {
    expect(() => decodeJwt(`${b64url('not json')}.${b64url('{}')}.x`)).toThrow('header is not valid JSON');
    expect(() => decodeJwt(`${b64url('{}')}.${b64url('[1]')}.x`)).toThrow('payload must be a JSON object');
    expect(() => decodeJwt('%%%.e30.x')).toThrow('header is not valid Base64url');
  });
});

describe('time claims', () => {
  const payload = { exp: 2000, nbf: 1000, iat: 500 };

  it('converts numeric claims to dates and skips malformed ones', () => {
    expect(timeClaims(payload).map(c => [ c.name, c.date.getTime() ])).toEqual([[ 'exp', 2000000 ], [ 'nbf', 1000000 ], [ 'iat', 500000 ]]);
    expect(timeClaims({ exp: '2000', nbf: null, iat: Infinity })).toEqual([]);
  });

  it('reports token status relative to now', () => {
    expect(tokenStatus(payload, new Date(1500 * 1000))).toBe('valid');
    expect(tokenStatus(payload, new Date(2000 * 1000))).toBe('expired');
    expect(tokenStatus(payload, new Date(900 * 1000))).toBe('not-yet-valid');
    expect(tokenStatus({ sub: 'x' }, new Date())).toBe('no-expiry');
    expect(tokenStatus({ iat: 1 }, new Date())).toBe('no-expiry');
  });
});

describe('keyKindFor', () => {
  it('asks for the right kind of key', () => {
    expect(keyKindFor('HS256')).toBe('secret');
    expect(keyKindFor('RS256')).toBe('public-key');
    expect(keyKindFor('ES384')).toBe('public-key');
    expect(keyKindFor('none')).toBe('none');
    expect(keyKindFor(undefined)).toBe('none');
    expect(keyKindFor('EdDSA')).toBe('none');
  });
});

describe('verifyJwt', () => {
  it('verifies an HMAC token and rejects a wrong secret', async () => {
    const jwt = decodeJwt(hs256({ sub: '1' }, 'correct-secret'));
    expect(await verifyJwt(jwt, 'correct-secret')).toEqual({ ok: true, valid: true });
    expect(await verifyJwt(jwt, 'wrong-secret')).toEqual({ ok: true, valid: false });
  });

  it('rejects a tampered payload', async () => {
    const [ header, , signature ] = hs256({ role: 'user' }, 'k').split('.');
    const forged = `${header}.${b64url(JSON.stringify({ role: 'admin' }))}.${signature}`;
    expect(await verifyJwt(decodeJwt(forged), 'k')).toEqual({ ok: true, valid: false });
  });

  it('supports a base64-encoded secret', async () => {
    const raw = Buffer.from('binary-secret-bytes');
    const input = unsigned({ alg: 'HS256' }, { a: 1 });
    const token = `${input}.${createHmac('sha256', raw).update(input)
      .digest('base64url')}`;
    expect(await verifyJwt(decodeJwt(token), raw.toString('base64'), true)).toEqual({ ok: true, valid: true });
  });

  async function signed(alg: string, signParams: AlgorithmIdentifier | RsaPssParams | EcdsaParams, keyPair: CryptoKeyPair) {
    const input = unsigned({ alg }, { sub: 'x' });
    const signature = await crypto.subtle.sign(signParams, keyPair.privateKey, new TextEncoder().encode(input));
    return decodeJwt(`${input}.${b64url(new Uint8Array(signature))}`);
  }

  function toPem(spki: ArrayBuffer): string {
    const body = Buffer.from(spki).toString('base64')
      .match(/.{1,64}/g)!.join('\n');
    return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
  }

  it('verifies RS256 with a PEM public key', async () => {
    const algorithm = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' };
    const pair = await crypto.subtle.generateKey(algorithm, true, [ 'sign', 'verify' ]);
    const jwt = await signed('RS256', { name: 'RSASSA-PKCS1-v1_5' }, pair);
    const pem = toPem(await crypto.subtle.exportKey('spki', pair.publicKey));
    expect(await verifyJwt(jwt, pem)).toEqual({ ok: true, valid: true });

    const other = await crypto.subtle.generateKey(algorithm, true, [ 'sign', 'verify' ]);
    expect(await verifyJwt(jwt, toPem(await crypto.subtle.exportKey('spki', other.publicKey)))).toEqual({ ok: true, valid: false });
  });

  it('verifies PS256 with a JWK', async () => {
    const algorithm = { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([ 1, 0, 1 ]), hash: 'SHA-256' };
    const pair = await crypto.subtle.generateKey(algorithm, true, [ 'sign', 'verify' ]);
    const jwt = await signed('PS256', { name: 'RSA-PSS', saltLength: 32 }, pair);
    const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
    expect(await verifyJwt(jwt, jwk)).toEqual({ ok: true, valid: true });
  });

  it('verifies ES256 and ES512', async () => {
    for (const [ alg, curve, hash ] of [[ 'ES256', 'P-256', 'SHA-256' ], [ 'ES512', 'P-521', 'SHA-512' ]]) {
      const algorithm = { name: 'ECDSA', namedCurve: curve };
      const pair = await crypto.subtle.generateKey(algorithm, true, [ 'sign', 'verify' ]);
      const jwt = await signed(alg, { name: 'ECDSA', hash }, pair);
      expect(await verifyJwt(jwt, toPem(await crypto.subtle.exportKey('spki', pair.publicKey)))).toEqual({ ok: true, valid: true });
    }
  });

  it('explains unusable input', async () => {
    const jwt = decodeJwt(hs256({}, 's'));
    expect(await verifyJwt(jwt, '')).toMatchObject({ ok: false, message: expect.stringContaining('Enter a key') });
    expect(await verifyJwt(decodeJwt(`${b64url('{"alg":"none"}')}.${b64url('{}')}.`), 'x')).toMatchObject({ ok: false, message: expect.stringContaining('unsigned') });
    expect(await verifyJwt(decodeJwt(`${b64url('{"alg":"EdDSA"}')}.${b64url('{}')}.x`), 'x')).toMatchObject({ ok: false, message: expect.stringContaining('does not support') });
    const rsa = decodeJwt(`${b64url('{"alg":"RS256"}')}.${b64url('{}')}.x`);
    expect(await verifyJwt(rsa, '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----')).toMatchObject({ ok: false, message: expect.stringContaining('private key') });
    expect(await verifyJwt(rsa, 'not a key')).toMatchObject({ ok: false });
  });
});
