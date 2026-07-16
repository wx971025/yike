import { useMemo, useState } from "react";
import { aiApi } from "../api";
import type { WordExample } from "../types";
import { IconButton, StarIcon } from "./ItemIcons";

const MAX_EXAMPLES = 3;

interface WordExamplesEditorProps {
  word: string;
  meaning: string;
  pos: string;
  phonetic: string;
  examples: WordExample[];
  onChange: (examples: WordExample[]) => void;
}

function normalizeRows(examples: WordExample[]): WordExample[] {
  if (examples.length > 0) {
    return examples.slice(0, MAX_EXAMPLES);
  }
  return [{ en: "", zh: "" }];
}

export default function WordExamplesEditor({
  word,
  meaning,
  pos,
  phonetic,
  examples,
  onChange,
}: WordExamplesEditorProps) {
  const rows = useMemo(() => normalizeRows(examples), [examples]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const updateRow = (index: number, patch: Partial<WordExample>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = () => {
    if (rows.length >= MAX_EXAMPLES) return;
    onChange([...rows, { en: "", zh: "" }]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([{ en: "", zh: "" }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!word.trim()) {
      setError("请先填写单词");
      return;
    }
    if (rows.length >= MAX_EXAMPLES && rows.every((row) => row.en.trim() || row.zh.trim())) {
      setError("最多添加 3 条例句");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const existing = rows.filter((row) => row.en.trim() || row.zh.trim());
      const res = await aiApi.generateWordExample({
        word: word.trim(),
        meaning: meaning.trim(),
        pos: pos.trim(),
        phonetic: phonetic.trim(),
        existing_examples: existing,
      });

      const emptyIndex = rows.findIndex((row) => !row.en.trim() && !row.zh.trim());
      if (emptyIndex >= 0) {
        const next = rows.map((row, i) =>
          i === emptyIndex ? { en: res.data.en, zh: res.data.zh } : row
        );
        onChange(next);
      } else if (rows.length < MAX_EXAMPLES) {
        onChange([...rows, { en: res.data.en, zh: res.data.zh }]);
      } else {
        setError("最多添加 3 条例句");
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "AI 生成失败";
      setError(typeof detail === "string" ? detail : "AI 生成失败");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          例句 <span className="font-normal text-slate-400 dark:text-slate-500">（可选，最多 3 句）</span>
        </label>
        <IconButton
          title="AI 生成例句"
          onClick={() => void handleGenerate()}
          disabled={generating || !word.trim()}
          className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
        >
          <StarIcon />
        </IconButton>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                例句 {index + 1}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-xs text-slate-400 transition hover:text-red-500"
                >
                  删除
                </button>
              )}
            </div>
            <textarea
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
              value={row.en}
              onChange={(e) => updateRow(index, { en: e.target.value })}
              rows={2}
              placeholder="英文例句"
            />
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
              value={row.zh}
              onChange={(e) => updateRow(index, { zh: e.target.value })}
              rows={2}
              placeholder="中文翻译"
            />
          </div>
        ))}
      </div>

      {rows.length < MAX_EXAMPLES && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4v12" strokeLinecap="round" />
            <path d="M4 10h12" strokeLinecap="round" />
          </svg>
          <span>添加例句</span>
        </button>
      )}

      {generating && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">AI 正在生成例句...</p>
      )}
    </div>
  );
}

export function sanitizeWordExamples(examples: WordExample[]): WordExample[] {
  return examples
    .map((row) => ({ en: row.en.trim(), zh: row.zh.trim() }))
    .filter((row) => row.en || row.zh)
    .slice(0, MAX_EXAMPLES);
}

export function wordExamplesFromWord(word: {
  examples?: WordExample[];
  example?: string;
  example_translation?: string;
}): WordExample[] {
  if (word.examples && word.examples.length > 0) {
    return word.examples;
  }
  if (word.example?.trim() || word.example_translation?.trim()) {
    return [
      {
        en: word.example?.trim() || "",
        zh: word.example_translation?.trim() || "",
      },
    ];
  }
  return [{ en: "", zh: "" }];
}
