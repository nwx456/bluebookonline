"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import { java } from "@codemirror/lang-java";
import { indentWithTab, defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { cn } from "@/lib/utils";

export interface BluebookCodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  disabled?: boolean;
  label?: string;
}

export function BluebookCodeEditor({
  value,
  onChange,
  className,
  disabled = false,
  label,
}: BluebookCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        java(),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        keymap.of([
          indentWithTab,
          {
            key: "Enter",
            run: (view) => {
              const { state } = view;
              const pos = state.selection.main.head;
              const line = state.doc.lineAt(pos);
              const before = line.text.slice(0, pos - line.from);
              const indentMatch = before.match(/^(\s*)/);
              const prevChar = before.slice(-1);
              const baseIndent = indentMatch?.[1] ?? "";
              let insert = "\n" + baseIndent;
              if (prevChar === "{") insert += "    ";
              view.dispatch({
                changes: { from: pos, insert },
                selection: { anchor: pos + insert.length },
              });
              return true;
            },
          },
          {
            key: "{",
            run: (view) => {
              const pos = view.state.selection.main.head;
              view.dispatch({
                changes: { from: pos, insert: "{}" },
                selection: { anchor: pos + 1 },
              });
              return true;
            },
          },
          {
            key: "(",
            run: (view) => {
              const pos = view.state.selection.main.head;
              view.dispatch({
                changes: { from: pos, insert: "()" },
                selection: { anchor: pos + 1 },
              });
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.editable.of(!disabled),
        EditorView.theme({
          "&": { fontSize: "14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
          ".cm-content": { padding: "12px 0", minHeight: "240px" },
          ".cm-gutters": { backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0" },
          ".cm-activeLine": { backgroundColor: "#f1f5f9" },
        }),
      ],
    });

    const view = new EditorView({ state: startState, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div className={cn("flex flex-col border border-gray-300 bg-white", className)}>
      {label && (
        <div className="border-b border-gray-200 bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-gray-600">
          {label}
          <span className="ml-2 font-normal text-gray-400">Tab indents · Enter auto-indents · Brackets auto-close</span>
        </div>
      )}
      <div ref={containerRef} className="overflow-auto" />
    </div>
  );
}
