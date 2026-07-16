import { useState } from "react";
import { confusablePairApi } from "../api";
import type { ConfusablePairFromReviewPreview } from "../api";

interface ConfusablePairPromptModalProps {
  sourceWordId: number;
  preview: ConfusablePairFromReviewPreview;
  correctMeaning: string;
  onClose: () => void;
  onAdded?: () => void;
}

function WordPreview({
  word,
  phonetic,
  meaning,
}: {
  word: string;
  phonetic: string;
  meaning: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{word}</p>
      {phonetic && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{phonetic}</p>
      )}
      {meaning && (
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {meaning}
        </p>
      )}
    </div>
  );
}

export default function ConfusablePairPromptModal({
  sourceWordId,
  preview,
  correctMeaning,
  onClose,
  onAdded,
}: ConfusablePairPromptModalProps) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    setError("");
    setAdding(true);
    try {
      const res = await confusablePairApi.createFromReview({
        source_word_id: sourceWordId,
        typed_word: preview.typed_word,
      });
      if (res.data.created) {
        window.dispatchEvent(new CustomEvent("app-data-changed"));
        onAdded?.();
      }
      onClose();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "添加失败";
      setError(typeof detail === "string" ? detail : "添加失败");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <h2 className="mb-2 text-lg font-bold text-slate-800 dark:text-slate-100">
          添加为易混词对？
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          你输入的单词与正确答案不同，但词典可查。是否将这一对加入易混词列表？
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <WordPreview
            word={preview.correct_word}
            phonetic=""
            meaning={correctMeaning}
          />
          <div className="flex shrink-0 items-center justify-center text-slate-300 dark:text-slate-600">
            ↔
          </div>
          <WordPreview
            word={preview.typed_word}
            phonetic={preview.typed_phonetic}
            meaning={preview.typed_meaning}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            暂不添加
          </button>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {adding ? "添加中..." : "添加易混词对"}
          </button>
        </div>
      </div>
    </div>
  );
}
