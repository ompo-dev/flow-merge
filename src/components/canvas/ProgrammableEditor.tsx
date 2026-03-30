"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useMonaco } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import type { EditorCompletionItem } from "@/lib/node-programming";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const completionRegistry = new Map<string, EditorCompletionItem[]>();
const registeredLanguages = new Set<string>();
let themeRegistered = false;

function getMonacoKind(
  monaco: NonNullable<ReturnType<typeof useMonaco>>,
  kind: EditorCompletionItem["kind"],
) {
  switch (kind) {
    case "function":
      return monaco.languages.CompletionItemKind.Function;
    case "snippet":
      return monaco.languages.CompletionItemKind.Snippet;
    default:
      return monaco.languages.CompletionItemKind.Variable;
  }
}

export function ProgrammableEditor({
  modelPath,
  language,
  value,
  height,
  suggestions,
  onChange,
}: {
  modelPath: string;
  language: "javascript" | "json";
  value: string;
  height: number;
  suggestions: EditorCompletionItem[];
  onChange: (value: string) => void;
}) {
  const monaco = useMonaco();

  useEffect(() => {
    completionRegistry.set(modelPath, suggestions);
  }, [modelPath, suggestions]);

  useEffect(() => {
    if (!monaco || registeredLanguages.has(language)) return;

    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const completions = completionRegistry.get(model.uri.toString()) ?? [];
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: completions.map((item) => ({
            label: item.label,
            insertText: item.insertText,
            detail: item.detail,
            documentation: item.documentation,
            kind: getMonacoKind(monaco, item.kind),
            range,
            insertTextRules:
              item.kind === "snippet"
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
          })),
        };
      },
    });

    registeredLanguages.add(language);
  }, [language, monaco]);

  const handleMount: OnMount = (editor, instance) => {
    if (!themeRegistered) {
      instance.editor.defineTheme("flow-merge-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#0d1117",
          "editor.lineHighlightBackground": "#161b22",
          "editorLineNumber.foreground": "#30363d",
          "editorLineNumber.activeForeground": "#7d8590",
          "editorCursor.foreground": "#58a6ff",
          "editor.selectionBackground": "#1f6feb30",
          "editor.inactiveSelectionBackground": "#1f6feb18",
        },
      });
      themeRegistered = true;
    }

    instance.editor.setTheme("flow-merge-dark");

    editor.trigger("keyboard", "editor.action.inlineSuggest.trigger", {});
  };

  return (
    <div className="overflow-hidden rounded border border-[#30363d] bg-[#0d1117]">
      <MonacoEditor
        path={modelPath}
        language={language}
        theme="flow-merge-dark"
        value={value}
        onMount={handleMount}
        onChange={(next) => onChange(next ?? "")}
        height={height}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          wordWrap: "on",
          lineNumbers: "on",
          folding: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 10, bottom: 10 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            strings: true,
            comments: false,
          },
        }}
      />
    </div>
  );
}
