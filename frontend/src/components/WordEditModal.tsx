import { useEffect, useState } from "react";
import { wordApi, type WordPayload } from "../api";
import { useGroups } from "../context/GroupContext";
import type { Word } from "../types";
import WordExamplesEditor, {
  sanitizeWordExamples,
  wordExamplesFromWord,
} from "./WordExamplesEditor";

interface WordEditModalProps {
  word: Word;
  open: boolean;
  onClose: () => void;
  onSaved: (word: Word) => void;
}

export default function WordEditModal({
  word,
  open,
  onClose,
  onSaved,
}: WordEditModalProps) {
  const { groups } = useGroups();
  const [form, setForm] = useState<WordPayload>({
    word: word.word,
    phonetic: word.phonetic,
    pos: word.pos,
    meaning: word.meaning,
    example: word.example,
    example_translation: word.example_translation,
    examples: wordExamplesFromWord(word),
    group_id: word.group_id,
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      word: word.word,
      phonetic: word.phonetic,
      pos: word.pos,
      meaning: word.meaning,
      example: word.example,
      example_translation: word.example_translation,
      examples: wordExamplesFromWord(word),
      group_id: word.group_id,
    });
    setFormError("");
  }, [open, word]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const examples = sanitizeWordExamples(form.examples);
      const res = await wordApi.update(word.id, {
        ...form,
        examples,
        example: examples[0]?.en ?? "",
        example_translation: examples[0]?.zh ?? "",
      });
      onSaved(res.data);
      onClose();
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "保存失败";
      setFormError(typeof detail === "string" ? detail : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
          编辑单词
        </h2>

        {formError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {formError}
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          单词
        </label>
        <input
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
          value={form.word}
          onChange={(e) => setForm({ ...form, word: e.target.value })}
          required
        />

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          音标{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            （可选，留空自动查词典）
          </span>
        </label>
        <input
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
          value={form.phonetic}
          onChange={(e) => setForm({ ...form, phonetic: e.target.value })}
          placeholder="/həˈloʊ/"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          词性{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            （可选，留空自动查词典）
          </span>
        </label>
        <input
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
          value={form.pos}
          onChange={(e) => setForm({ ...form, pos: e.target.value })}
          placeholder="n. / v. / adj."
        />

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          释义{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            （可选，留空自动查词典）
          </span>
        </label>
        <textarea
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
          value={form.meaning}
          onChange={(e) => setForm({ ...form, meaning: e.target.value })}
          rows={2}
        />

        <WordExamplesEditor
          word={form.word}
          meaning={form.meaning}
          pos={form.pos}
          phonetic={form.phonetic}
          examples={form.examples}
          onChange={(examples) => setForm({ ...form, examples })}
        />

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          分组
        </label>
        <select
          className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
          value={form.group_id ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              group_id: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        >
          <option value="">无分组</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
