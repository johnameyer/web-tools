import { ensureSyntaxTree, foldable, foldEffect, unfoldAll } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';

/** Folds every nested block but leaves the top-level one open, so the document's shape stays visible. */
export function collapseAll(view: EditorView): void {
  const { state } = view;
  // The tree is otherwise only parsed as far as the viewport, which would leave later blocks unfolded
  ensureSyntaxTree(state, state.doc.length, 200);
  const effects = [];
  for (let lineNumber = 2; lineNumber <= state.doc.lines; lineNumber++) {
    const line = state.doc.line(lineNumber);
    const range = foldable(state, line.from, line.to);
    if (range) {
      effects.push(foldEffect.of(range));
    }
  }
  if (effects.length) {
    view.dispatch({ effects });
  }
}

export function expandAll(view: EditorView): void {
  unfoldAll(view);
}
