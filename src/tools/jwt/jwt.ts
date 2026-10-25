import { decodeBase64 } from '../base64/base64';

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** Base64url signature segment as it appeared in the token */
  signature: string;
  /** `header.payload` exactly as signed */
  signingInput: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeSegment(segment: string, name: string): Record<string, unknown> {
  let json: string;
  try {
    json = decodeBase64(segment);
  } catch (e) {
    throw new Error(`The ${name} is not valid Base64url text (${e instanceof Error ? e.message : 'decode failed'})`);
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error(`The ${name} is not valid JSON`);
  }
  if (!isObject(value)) {
    throw new Error(`The ${name} must be a JSON object`);
  }
  return value;
}

/** Accepts a bare token or one prefixed with `Bearer `. Throws a user-facing Error when it is not a decodable JWT. */
export function decodeJwt(input: string): DecodedJwt {
  const token = input.trim().replace(/^bearer\s+/i, '')
    .replace(/\s+/g, '');
  if (!token) {
    throw new Error('Paste a JWT to decode it');
  }
  const parts = token.split('.');
  if (parts.length === 5) {
    throw new Error('This looks like an encrypted JWT (JWE, 5 parts). Only signed tokens (JWS, 3 parts) can be decoded here');
  }
  if (parts.length !== 3) {
    throw new Error(`A JWT has 3 dot-separated parts, but this has ${parts.length}`);
  }
  const [ header, payload, signature ] = parts;
  return {
    header: decodeSegment(header, 'header'),
    payload: decodeSegment(payload, 'payload'),
    signature,
    signingInput: `${header}.${payload}`,
  };
}

export interface TimeClaim {
  name: 'exp' | 'nbf' | 'iat';
  date: Date;
}

/** Numeric `exp`, `nbf` and `iat` claims (seconds since the epoch) as dates; malformed values are skipped. */
export function timeClaims(payload: Record<string, unknown>): TimeClaim[] {
  const claims: TimeClaim[] = [];
  for (const name of [ 'exp', 'nbf', 'iat' ] as const) {
    const value = payload[name];
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value * 1000);
      if (!Number.isNaN(date.getTime())) {
        claims.push({ name, date });
      }
    }
  }
  return claims;
}

export type TokenStatus = 'expired' | 'not-yet-valid' | 'valid' | 'no-expiry';

export function tokenStatus(payload: Record<string, unknown>, now: Date): TokenStatus {
  const claims = timeClaims(payload);
  const exp = claims.find(claim => claim.name === 'exp');
  const nbf = claims.find(claim => claim.name === 'nbf');
  if (exp && now >= exp.date) {
    return 'expired';
  }
  if (nbf && now < nbf.date) {
    return 'not-yet-valid';
  }
  return exp ? 'valid' : 'no-expiry';
}

interface AlgorithmSpec {
  family: 'HMAC' | 'RSASSA-PKCS1-v1_5' | 'RSA-PSS' | 'ECDSA';
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
  namedCurve?: 'P-256' | 'P-384' | 'P-521';
}

const HASH_BYTES = { 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 } as const;

const ALGORITHMS: Record<string, AlgorithmSpec> = {
  HS256: { family: 'HMAC', hash: 'SHA-256' },
  HS384: { family: 'HMAC', hash: 'SHA-384' },
  HS512: { family: 'HMAC', hash: 'SHA-512' },
  RS256: { family: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  RS384: { family: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
  RS512: { family: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
  PS256: { family: 'RSA-PSS', hash: 'SHA-256' },
  PS384: { family: 'RSA-PSS', hash: 'SHA-384' },
  PS512: { family: 'RSA-PSS', hash: 'SHA-512' },
  ES256: { family: 'ECDSA', hash: 'SHA-256', namedCurve: 'P-256' },
  ES384: { family: 'ECDSA', hash: 'SHA-384', namedCurve: 'P-384' },
  ES512: { family: 'ECDSA', hash: 'SHA-512', namedCurve: 'P-521' },
};

export type KeyKind = 'secret' | 'public-key' | 'none';

/** What to ask the user for, based on the token's `alg` header. */
export function keyKindFor(alg: unknown): KeyKind {
  if (typeof alg !== 'string' || !(alg in ALGORITHMS)) {
    return 'none';
  }
  return ALGORITHMS[alg].family === 'HMAC' ? 'secret' : 'public-key';
}

function base64ToBytes(text: string): Uint8Array {
  const normalized = text.replace(/\s+/g, '').replace(/-/g, '+')
    .replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function importVerificationKey(spec: AlgorithmSpec, keyInput: string, secretIsBase64: boolean): Promise<CryptoKey> {
  const text = keyInput.trim();
  if (spec.family === 'HMAC') {
    const bytes = secretIsBase64 ? base64ToBytes(text) : new TextEncoder().encode(keyInput);
    return crypto.subtle.importKey('raw', bytes as BufferSource, { name: 'HMAC', hash: spec.hash }, false, [ 'verify' ]);
  }

  const algorithm = spec.family === 'ECDSA'
    ? { name: 'ECDSA', namedCurve: spec.namedCurve }
    : { name: spec.family, hash: spec.hash };

  if (text.startsWith('{')) {
    const jwk = JSON.parse(text) as JsonWebKey;
    return crypto.subtle.importKey('jwk', jwk, algorithm, false, [ 'verify' ]);
  }

  const pem = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----/.exec(text);
  if (pem && pem[1] !== 'PUBLIC KEY') {
    throw new Error(
      pem[1].includes('PRIVATE')
        ? 'That is a private key. Paste the public key instead'
        : `Unsupported PEM type "${pem[1]}". Use a "PUBLIC KEY" (SPKI) block or a JWK`,
    );
  }
  const der = base64ToBytes(pem ? pem[2] : text);
  return crypto.subtle.importKey('spki', der as BufferSource, algorithm, false, [ 'verify' ]);
}

export type VerifyOutcome =
  | { ok: true; valid: boolean }
  | { ok: false; message: string };

export async function verifyJwt(jwt: DecodedJwt, keyInput: string, secretIsBase64 = false): Promise<VerifyOutcome> {
  const alg = jwt.header.alg;
  if (alg === 'none') {
    return { ok: false, message: 'This token is unsigned (alg "none"), so there is nothing to verify' };
  }
  if (typeof alg !== 'string' || !(alg in ALGORITHMS)) {
    return { ok: false, message: `Verification does not support the algorithm ${JSON.stringify(alg)}` };
  }
  if (!keyInput.trim()) {
    return { ok: false, message: 'Enter a key to verify the signature' };
  }

  const spec = ALGORITHMS[alg];
  try {
    const key = await importVerificationKey(spec, keyInput, secretIsBase64);
    const verifyAlgorithm = spec.family === 'RSA-PSS'
      ? { name: 'RSA-PSS', saltLength: HASH_BYTES[spec.hash] }
      : spec.family === 'ECDSA' ? { name: 'ECDSA', hash: spec.hash } : { name: spec.family };
    const valid = await crypto.subtle.verify(
      verifyAlgorithm,
      key,
      base64ToBytes(jwt.signature) as BufferSource,
      new TextEncoder().encode(jwt.signingInput),
    );
    return { ok: true, valid };
  } catch (e) {
    return { ok: false, message: e instanceof Error && e.message ? `Could not use that key: ${e.message}` : 'Could not use that key' };
  }
}
