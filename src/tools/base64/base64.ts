export function encodeBase64(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary);
  return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_')
    .replace(/=+$/, '') : encoded;
}

/** Accepts standard or URL-safe input, with or without padding or whitespace. Throws on invalid input. */
export function decodeBase64(input: string): string {
  const normalized = input.replace(/\s+/g, '').replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error('Input is not valid Base64');
  }
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Decoded bytes are not valid UTF-8 text');
  }
}
