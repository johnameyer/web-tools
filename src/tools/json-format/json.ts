export interface JsonError {
  message: string;
  line?: number;
  column?: number;
}

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: JsonError };

export interface FormatOptions {
  /** Number of spaces, or 'tab' */
  indent: number | 'tab';
  sortKeys: boolean;
}

function locate(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    // Engines differ: some report "position N", some "line L column C", some neither
    const lineColumn = /line (\d+) column (\d+)/.exec(message);
    if (lineColumn) {
      return { ok: false, error: { message, line: Number(lineColumn[1]), column: Number(lineColumn[2]) }};
    }
    const position = /position (\d+)/.exec(message);
    if (position) {
      return { ok: false, error: { message, ...locate(text, Number(position[1])) }};
    }
    return { ok: false, error: { message }};
  }
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([ a ], [ b ]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([ key, child ]) => [ key, sortKeysDeep(child) ]),
    );
  }
  return value;
}

/** Pass `indent: 0` to minify. */
export function formatJson(value: unknown, { indent, sortKeys }: FormatOptions): string {
  const source = sortKeys ? sortKeysDeep(value) : value;
  return JSON.stringify(source, null, indent === 'tab' ? '\t' : indent);
}

export type FormatTextResult =
  | { ok: true; text: string }
  | { ok: false; error: JsonError };

/** Parses and re-serializes in one step; pass `indent: 0` to minify. */
export function formatText(text: string, options: FormatOptions): FormatTextResult {
  const parsed = parseJson(text);
  return parsed.ok ? { ok: true, text: formatJson(parsed.value, options) } : parsed;
}
