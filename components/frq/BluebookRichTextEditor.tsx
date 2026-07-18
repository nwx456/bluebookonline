"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  IndentIncrease,
  Omega,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SYMBOLS = [
  "—", "–", "…", "©", "®", "°", "±", "×", "÷", "≤", "≥", "≠", "≈",
  "α", "β", "γ", "δ", "π", "μ", "Ω", "∑", "√", "∞", "→", "←", "↑", "↓",
  "é", "è", "ê", "ë", "à", "â", "ä", "ù", "û", "ü", "ô", "ö", "ñ", "ç",
];

export interface BluebookRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function BluebookRichTextEditor({
  value,
  onChange,
  placeholder = "Enter your response here…",
  className,
  disabled = false,
}: BluebookRichTextEditorProps) {
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const internalClipboard = useRef("");
  const skipUpdate = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Superscript,
      Subscript,
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] px-4 py-3 text-base leading-relaxed text-gray-900 outline-none prose prose-sm max-w-none",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (skipUpdate.current) return;
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      skipUpdate.current = true;
      editor.commands.setContent(value || "", { emitUpdate: false });
      skipUpdate.current = false;
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const run = useCallback(
    (fn: () => void) => {
      if (!editor || disabled) return;
      fn();
    },
    [editor, disabled]
  );

  const handleCut = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to);
    internalClipboard.current = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be unavailable */
    }
    editor.chain().focus().deleteSelection().run();
  };

  const handleCopy = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to);
    internalClipboard.current = text;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const handlePaste = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        internalClipboard.current = text;
        editor.chain().focus().insertContent(text).run();
        return;
      }
    } catch {
      /* fall back to internal clipboard */
    }
    if (internalClipboard.current) {
      editor.chain().focus().insertContent(internalClipboard.current).run();
    }
  };

  const insertSymbol = (symbol: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(symbol).run();
    setSymbolsOpen(false);
  };

  const indentParagraph = () => {
    if (!editor) return;
    editor.chain().focus().insertContent("\t").run();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editor?.isFocused) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "b") { e.preventDefault(); editor.chain().focus().toggleBold().run(); }
        if (e.key === "i") { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }
        if (e.key === "u") { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); editor.chain().focus().undo().run(); }
        if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); editor.chain().focus().redo().run(); }
        if (e.key === "/" && e.shiftKey) { e.preventDefault(); setSymbolsOpen((o) => !o); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor]);

  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded border text-gray-700 transition-colors",
        active ? "border-blue-600 bg-blue-50 text-blue-700" : "border-transparent hover:bg-gray-100",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn("relative flex flex-col border border-gray-300 bg-white", className)}>
      <div
        role="toolbar"
        aria-label="Response editor toolbar"
        className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-[#f8fafc] px-2 py-1.5"
      >
        <ToolBtn title="Undo (Ctrl+Z)" onClick={() => run(() => editor.chain().focus().undo().run())}>
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Redo (Ctrl+Y)" onClick={() => run(() => editor.chain().focus().redo().run())}>
          <Redo2 className="h-4 w-4" />
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolBtn title="Cut (Ctrl+X)" onClick={handleCut}>
          <Scissors className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Copy (Ctrl+C)" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Paste (Ctrl+V)" onClick={handlePaste}>
          <ClipboardPaste className="h-4 w-4" />
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolBtn
          title="Bold (Ctrl+B)"
          active={editor.isActive("bold")}
          onClick={() => run(() => editor.chain().focus().toggleBold().run())}
        >
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          title="Italic (Ctrl+I)"
          active={editor.isActive("italic")}
          onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
        >
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          title="Underline (Ctrl+U)"
          active={editor.isActive("underline")}
          onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          title="Superscript (Ctrl+Shift++)"
          active={editor.isActive("superscript")}
          onClick={() => run(() => editor.chain().focus().toggleSuperscript().run())}
        >
          <SuperscriptIcon className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          title="Subscript (Ctrl+Shift+-)"
          active={editor.isActive("subscript")}
          onClick={() => run(() => editor.chain().focus().toggleSubscript().run())}
        >
          <SubscriptIcon className="h-4 w-4" />
        </ToolBtn>
        <div className="relative">
          <ToolBtn title="Insert Symbol (Ctrl+Shift+/)" onClick={() => setSymbolsOpen((o) => !o)}>
            <Omega className="h-4 w-4" />
          </ToolBtn>
          {symbolsOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 grid max-h-48 w-64 grid-cols-8 gap-1 overflow-auto rounded border border-gray-200 bg-white p-2 shadow-lg">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded p-1 text-sm hover:bg-gray-100"
                  onClick={() => insertSymbol(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <ToolBtn title="Indent" onClick={indentParagraph}>
          <IndentIncrease className="h-4 w-4" />
        </ToolBtn>
      </div>
      <div className="relative flex-1 overflow-auto">
        <EditorContent editor={editor} />
        {!editor.getText().trim() && (
          <p className="pointer-events-none absolute left-4 top-3 text-gray-400">{placeholder}</p>
        )}
      </div>
    </div>
  );
}
