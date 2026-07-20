import { useEffect, useRef, useState } from "react";
import { confusablePairApi } from "../api";

interface ConfusablePairCreateModalProps {
  open: boolean;
  onClose: () => void;
  initialWordA?: string;
  lockWordA?: boolean;
  onCreated?: () => void;
}

export default function ConfusablePairCreateModal({
  open,
  onClose,
  initialWordA = "",
  lockWordA = false,
  onCreated,
}: ConfusablePairCreateModalProps) {
  const [wordA, setWordA] = useState(initialWordA);
  const [wordB, setWordB] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const wordARef = useRef<HTMLInputElement>(null);
  const wordBRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setWordA(initialWordA);
    setWordB("");
    setError("");
    setInfo("");
    requestAnimationFrame(() => {
      if (lockWordA) {
        wordBRef.current?.focus();
      } else {
        wordARef.current?.focus();
      }
    });
  }, [open, initialWordA, lockWordA]);

  if (!open) return null;

  const submitPair = async () => {
    setError("");
    setInfo("");
    const a = wordA.trim();
    const b = wordB.trim();
    if (!a || !b) {
      setError("请填写两个单词");
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError("两个单词不能相同");
      return;
    }

    setSubmitting(true);
    try {
      const res = await confusablePairApi.create({ word_a: a, word_b: b });
      if (res.data.created) {
        window.dispatchEvent(new CustomEvent("app-data-changed"));
        onCreated?.();
        onClose();
        return;
      }
      if (res.data.pair) {
        setInfo("该易混词对已存在");
        window.dispatchEvent(new CustomEvent("app-data-changed"));
        onCreated?.();
        return;
      }
      setError("添加失败，请检查单词是否在词典中可查");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "添加失败";
      setError(typeof detail === "string" ? detail : "添加失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitPair();
  };

  const handleEnterKey = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "a" | "b"
  ) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || submitting) return;
    e.preventDefault();
    e.stopPropagation();
    if (field === "a" && !lockWordA && !wordB.trim()) {
      wordBRef.current?.focus();
      return;
    }
    if (wordA.trim() && wordB.trim()) {
      void submitPair();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <h2 className="mb-2 text-lg font-bold text-slate-800 dark:text-slate-100">
          增加易混词卡片
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          输入两个容易混淆的单词，系统会自动查词典补全释义并加入复习计划。
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              单词 A
            </label>
            <input
              ref={wordARef}
              value={wordA}
              onChange={(e) => setWordA(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, "a")}
              readOnly={lockWordA}
              disabled={submitting}
              placeholder="例如 affect"
              autoComplete="off"
              spellCheck={false}
              className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-rose-950/40 ${
                lockWordA ? "bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300" : ""
              }`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              单词 B
            </label>
            <input
              ref={wordBRef}
              value={wordB}
              onChange={(e) => setWordB(e.target.value)}
              onKeyDown={(e) => handleEnterKey(e, "b")}
              disabled={submitting}
              placeholder="例如 effect"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-rose-500 dark:focus:ring-rose-950/40"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {info}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting || !wordA.trim() || !wordB.trim()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? "添加中..." : "添加易混词对"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
