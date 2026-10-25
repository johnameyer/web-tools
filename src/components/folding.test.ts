import { json } from '@codemirror/lang-json';
import { codeFolding, foldedRanges } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';

import { collapseAll, expandAll } from './folding';

function createView(doc: string): EditorView {
  return new EditorView({ state: EditorState.create({ doc, extensions: [ json(), codeFolding() ] }), parent: document.body });
}

function foldedCount(view: EditorView): number {
  let count = 0;
  foldedRanges(view.state).between(0, view.state.doc.length, () => {
    count++;
  });
  return count;
}

const doc = JSON.stringify({ a: { b: [ 1, 2 ] }, c: { d: 1 }}, null, 2);

describe('folding', () => {
  it('collapses nested blocks but not the root', () => {
    const view = createView(doc);
    collapseAll(view);
    expect(foldedCount(view)).toBeGreaterThan(0);
    // The root opens on line 1, so its range must not be folded
    let rootFolded = false;
    foldedRanges(view.state).between(0, 1, () => {
      rootFolded = true;
    });
    expect(rootFolded).toBe(false);
  });

  it('expands everything again', () => {
    const view = createView(doc);
    collapseAll(view);
    expandAll(view);
    expect(foldedCount(view)).toBe(0);
  });

  it('is a no-op for a single line', () => {
    const view = createView('{"a":1}');
    collapseAll(view);
    expect(foldedCount(view)).toBe(0);
  });
});
