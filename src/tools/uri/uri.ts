export type UriScope = 'component' | 'full';

/** Component mode escapes everything reserved (for a query value or path segment); full mode keeps `:/?#&=` etc. intact. */
export function encodeUri(text: string, scope: UriScope): string {
  return scope === 'component' ? encodeURIComponent(text) : encodeURI(text);
}

/** Throws on malformed percent-escapes. */
export function decodeUri(text: string, scope: UriScope): string {
  try {
    return scope === 'component' ? decodeURIComponent(text) : decodeURI(text);
  } catch {
    throw new Error('Input contains a malformed percent-escape');
  }
}
