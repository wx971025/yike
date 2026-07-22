import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dictionaryApi, wordApi, type WordPayload } from "../api";
import ConfusablePairsPanel from "../components/ConfusablePairsPanel";
import ConfusablePairCreateModal from "../components/ConfusablePairCreateModal";
import GroupTag from "../components/GroupTag";
import BulkGroupEditModal from "../components/BulkGroupEditModal";
import ItemActionsMenu from "../components/ItemActionsMenu";
import PageGroupFilter from "../components/PageGroupFilter";
import PlanMultiSelectBar, {
  MultiSelectToggleButton,
  SelectCheckbox,
} from "../components/PlanMultiSelectBar";
import {
  IconButton,
  JoinPlanIcon,
  LeavePlanIcon,
} from "../components/ItemIcons";
import SearchBox from "../components/SearchBox";
import WordExamplesEditor, {
  sanitizeWordExamples,
  wordExamplesFromWord,
} from "../components/WordExamplesEditor";
import SortableHeader from "../components/SortableHeader";
import { useGroups } from "../context/GroupContext";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { getReviewStageOptions, type Word } from "../types";
import { filterGroupsByCategory } from "../utils/groupCategory";
import { ensureGroupsBeforeCreate } from "../utils/groupRequired";
import { isGroupFilterActive } from "../utils/groupFilter";
import { getNextReviewDate, getPlanCardStatus, getPlanCardStatusMeta } from "../utils/reviewSchedule";
import { wordTrackState } from "../utils/wordReviewTrack";
import {
  sortByCreatedAt,
  sortByWord,
  toggleSortDirection,
  type SortDirection,
} from "../utils/sort";

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

const emptyForm: WordPayload = {
  word: "",
  phonetic: "",
  pos: "",
  meaning: "",
  example: "",
  example_translation: "",
  examples: [{ en: "", zh: "" }],
  group_id: 0,
  stage_index: 0,
};

const MEANING_COLLAPSE_THRESHOLD = 48;

function BatchWordTextarea({
  value,
  onChange,
  highlightedMissing,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  highlightedMissing: string[];
  disabled?: boolean;
}) {
  const mirrorEl = useRef<HTMLDivElement | null>(null);
  const missingSet = useMemo(
    () => new Set(highlightedMissing.map((word) => word.toLowerCase())),
    [highlightedMissing]
  );
  const lines = value.split(/\r?\n/);
  const hasHighlights = highlightedMissing.length > 0;

  const syncScroll = (target: HTMLTextAreaElement) => {
    if (mirrorEl.current) {
      mirrorEl.current.scrollTop = target.scrollTop;
    }
  };

  return (
    <div className="relative mb-3 overflow-hidden rounded-lg">
      {hasHighlights && (
        <div
          ref={mirrorEl}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-auto rounded-lg border border-transparent px-3 py-2 font-mono text-sm leading-6 whitespace-pre-wrap break-words [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {lines.map((line, index) => {
            const trimmed = line.trim();
            const isMissing = Boolean(trimmed) && missingSet.has(trimmed.toLowerCase());
            return (
              <div
                key={index}
                className={
                  isMissing
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-800 dark:text-slate-100"
                }
              >
                {line || "\u00a0"}
              </div>
            );
          })}
        </div>
      )}
      <textarea
        className={`relative block w-full resize-none rounded-lg border px-3 py-2 font-mono text-sm leading-6 focus:border-blue-500 focus:outline-none disabled:opacity-60 dark:focus:border-blue-400 ${
          hasHighlights
            ? "border-red-300 bg-transparent text-transparent caret-slate-800 selection:bg-blue-200/60 dark:border-red-500/60 dark:caret-slate-100 dark:selection:bg-blue-500/30"
            : "border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        }`}
        style={hasHighlights ? { WebkitTextFillColor: "transparent" } : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => syncScroll(e.currentTarget)}
        rows={8}
        placeholder={"apple\nbanana\norange"}
        disabled={disabled}
        spellCheck={false}
      />
    </div>
  );
}

function CollapsibleMeaning({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsible =
    text.length > MEANING_COLLAPSE_THRESHOLD || text.includes("\n");

  return (
    <div>
      <p
        className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${
          expanded || !collapsible ? "whitespace-pre-wrap" : "line-clamp-2"
        }`}
      >
        {text}
      </p>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-blue-600 hover:text-blue-700"
        >
          {expanded ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
}

function WordExamplesDisplay({
  word,
}: {
  word: {
    examples?: { en: string; zh: string }[];
    example?: string;
    example_translation?: string;
  };
}) {
  const examples = wordExamplesFromWord(word).filter(
    (item) => item.en.trim() || item.zh.trim()
  );
  if (examples.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
      {examples.map((item, index) => (
        <div key={index}>
          {item.en.trim() && (
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {item.en}
            </p>
          )}
          {item.zh.trim() && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              {item.zh}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function WordsPage() {
  const { groups, memoryModeForGroupId, totalStagesForGroupId } = useGroups();
  const wordGroups = useMemo(
    () => filterGroupsByCategory(groups, "word"),
    [groups]
  );
  const [pageTab, setPageTab] = useState<"words" | "confusable">("words");
  const [createConfusableOpen, setCreateConfusableOpen] = useState(false);
  const [groupFilterIds, setGroupFilterIds] = useState<Set<number>>(new Set());
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<WordPayload>(emptyForm);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"word" | "created_at">("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkGroupModalOpen, setBulkGroupModalOpen] = useState(false);
  const [bulkGroupError, setBulkGroupError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const {
    selectMode,
    selectedIds,
    selectedCount,
    exitSelectMode,
    toggleSelectMode,
    toggleItem,
    toggleAll,
    isAllSelected,
    isPartiallySelected,
  } = useMultiSelect();
  const [formError, setFormError] = useState("");
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchGroupId, setBatchGroupId] = useState<number | null>(null);
  const [batchJoinPlan, setBatchJoinPlan] = useState(true);
  const [batchStageIndex, setBatchStageIndex] = useState(0);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchMissingConfirmOpen, setBatchMissingConfirmOpen] = useState(false);
  const [batchMissingWords, setBatchMissingWords] = useState<string[]>([]);
  const [batchWordsToAdd, setBatchWordsToAdd] = useState<string[]>([]);
  const [batchHighlightedMissing, setBatchHighlightedMissing] = useState<string[]>([]);

  const batchMemoryMode = memoryModeForGroupId(batchGroupId);
  const batchStageOptions = useMemo(
    () => getReviewStageOptions(batchMemoryMode),
    [batchMemoryMode]
  );
  const batchTotalStages = totalStagesForGroupId(batchGroupId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await wordApi.list(
        groupFilterIds,
        null,
        debouncedSearch || undefined
      );
      setWords(res.data);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [groupFilterIds, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load({ silent: true });
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleSortToggle = (field: "word" | "created_at") => {
    if (sortField === field) {
      setSortDirection(toggleSortDirection(sortDirection));
    } else {
      setSortField(field);
      setSortDirection(field === "created_at" ? "desc" : "asc");
    }
  };

  const sortedWords = useMemo(() => {
    if (sortField === "created_at") {
      return sortByCreatedAt(words, sortDirection);
    }
    return sortByWord(words, sortDirection);
  }, [words, sortField, sortDirection]);

  const visibleIds = useMemo(
    () => sortedWords.map((word) => word.id),
    [sortedWords]
  );

  const handleToggleSelectMode = () => {
    setOpenMenuId(null);
    toggleSelectMode();
  };

  const handleJoinSelected = async () => {
    if (selectedCount === 0) return;
    setBulkLoading(true);
    try {
      const targets = sortedWords.filter(
        (word) => selectedIds.has(word.id) && !word.in_plan
      );
      for (const word of targets) {
        await wordApi.joinPlan(word.id);
      }
      if (targets.length > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveSelected = async () => {
    if (selectedCount === 0) return;
    setBulkLoading(true);
    try {
      const targets = sortedWords.filter(
        (word) => selectedIds.has(word.id) && word.in_plan
      );
      for (const word of targets) {
        await wordApi.leavePlan(word.id);
      }
      if (targets.length > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    if (!confirm(`确定删除选中的 ${selectedCount} 个单词？`)) return;
    setBulkLoading(true);
    try {
      const targets = sortedWords.filter((word) => selectedIds.has(word.id));
      for (const word of targets) {
        await wordApi.remove(word.id);
      }
      if (targets.length > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleEditGroupSelected = () => {
    if (selectedCount === 0) return;
    if (wordGroups.length === 0) {
      const check = ensureGroupsBeforeCreate(groups, "word");
      if (!check.ok) {
        window.alert(check.message);
      }
      return;
    }
    setBulkGroupError("");
    setBulkGroupModalOpen(true);
  };

  const handleConfirmBulkGroup = async (groupId: number) => {
    const targets = sortedWords.filter((word) => selectedIds.has(word.id));
    if (targets.length === 0) return;

    setBulkLoading(true);
    setBulkGroupError("");

    const failed: string[] = [];
    let updated = 0;

    try {
      for (const word of targets) {
        if (word.group_id === groupId) continue;
        try {
          await wordApi.update(word.id, { group_id: groupId });
          updated += 1;
        } catch (err: unknown) {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? "移动失败";
          failed.push(
            `${word.word}：${typeof detail === "string" ? detail : "移动失败"}`
          );
        }
      }

      if (updated > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
        setBulkGroupModalOpen(false);
        exitSelectMode();
      } else if (failed.length > 0) {
        setBulkGroupError(
          failed.length === 1
            ? failed[0]
            : `${failed.slice(0, 2).join("；")}${
                failed.length > 2 ? ` 等 ${failed.length} 项失败` : ""
              }`
        );
      } else {
        setBulkGroupModalOpen(false);
        exitSelectMode();
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const openAddWords = () => {
    const check = ensureGroupsBeforeCreate(groups, "word", groupFilterIds);
    if (!check.ok) {
      window.alert(check.message);
      return;
    }
    setBatchText("");
    setBatchError("");
    setBatchGroupId(check.groupId);
    setBatchJoinPlan(true);
    setBatchStageIndex(0);
    setBatchMissingConfirmOpen(false);
    setBatchMissingWords([]);
    setBatchWordsToAdd([]);
    setBatchHighlightedMissing([]);
    setBatchModalOpen(true);
  };

  const parseBatchWords = (text: string) => {
    const seen = new Set<string>();
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((word) => {
        const key = word.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const lookupBatchWords = async (words: string[]) => {
    const missing: string[] = [];
    const found: string[] = [];

    for (const word of words) {
      try {
        const res = await dictionaryApi.lookup(word);
        if (res.data.found && res.data.meaning.trim()) {
          found.push(word);
        } else {
          missing.push(word);
        }
      } catch {
        missing.push(word);
      }
    }

    return { found, missing };
  };

  const addWordsBatch = async (wordsToAdd: string[]) => {
    if (wordsToAdd.length === 0) {
      setBatchError("词典均未收录这些单词，未添加任何内容");
      return;
    }
    if (!batchGroupId) {
      setBatchError("请选择分组");
      return;
    }

    const failed: { word: string; reason: string }[] = [];
    let created = 0;

    for (const word of wordsToAdd) {
      try {
        await wordApi.create({
          word,
          phonetic: "",
          pos: "",
          meaning: "",
          example: "",
          example_translation: "",
          examples: [],
          group_id: batchGroupId,
          stage_index: batchJoinPlan ? batchStageIndex : 0,
          in_plan: batchJoinPlan,
        });
        created += 1;
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "添加失败";
        failed.push({
          word,
          reason: typeof detail === "string" ? detail : "添加失败",
        });
      }
    }

    if (created > 0) {
      await load();
      window.dispatchEvent(new CustomEvent("app-data-changed"));
      setBatchModalOpen(false);
      setBatchMissingConfirmOpen(false);
    } else if (failed.length > 0) {
      setBatchError(
        failed.length === 1
          ? `${failed[0].word}：${failed[0].reason}`
          : `全部添加失败，共 ${failed.length} 个`
      );
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordsToAdd = parseBatchWords(batchText);
    if (wordsToAdd.length === 0) {
      setBatchError("请输入至少一个单词，每行一个");
      return;
    }

    setBatchSubmitting(true);
    setBatchError("");

    try {
      const { found, missing } = await lookupBatchWords(wordsToAdd);

      if (missing.length > 0) {
        setBatchMissingWords(missing);
        setBatchWordsToAdd(found);
        setBatchMissingConfirmOpen(true);
        return;
      }

      await addWordsBatch(wordsToAdd);
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleBatchCancelMissing = () => {
    setBatchMissingConfirmOpen(false);
    setBatchHighlightedMissing(batchMissingWords);
  };

  const handleBatchContinueWithMissing = async () => {
    setBatchSubmitting(true);
    setBatchError("");
    try {
      await addWordsBatch(batchWordsToAdd);
    } finally {
      setBatchSubmitting(false);
    }
  };

  const openEdit = (w: Word) => {
    setEditingId(w.id);
    setFormError("");
    setForm({
      word: w.word,
      phonetic: w.phonetic,
      pos: w.pos,
      meaning: w.meaning,
      example: w.example,
      example_translation: w.example_translation,
      examples: wordExamplesFromWord(w),
      group_id: w.group_id ?? wordGroups[0]?.id ?? 0,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    setFormError("");
    if (!form.group_id) {
      setFormError("请选择分组");
      return;
    }
    try {
      const examples = sanitizeWordExamples(form.examples);
      await wordApi.update(editingId, {
        ...form,
        examples,
        example: examples[0]?.en ?? "",
        example_translation: examples[0]?.zh ?? "",
      });
      setModalOpen(false);
      await load();
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "保存失败";
      setFormError(typeof detail === "string" ? detail : "保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该单词？")) return;
    await wordApi.remove(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinPlan = async (id: number) => {
    const res = await wordApi.joinPlan(id);
    setWords((prev) => prev.map((word) => (word.id === id ? res.data : word)));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeavePlan = async (id: number) => {
    const res = await wordApi.leavePlan(id);
    setWords((prev) => prev.map((word) => (word.id === id ? res.data : word)));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinAll = async () => {
    setBulkLoading(true);
    try {
      const res = await wordApi.joinPlanAll(
        groupFilterIds,
        debouncedSearch || undefined
      );
      if (res.data.count > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveAll = async () => {
    setBulkLoading(true);
    try {
      const res = await wordApi.leavePlanAll(
        groupFilterIds,
        debouncedSearch || undefined
      );
      if (res.data.count > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const inPlanCount = words.filter((w) => w.in_plan).length;
  const notInPlanCount = words.length - inPlanCount;
  const emptyMessage = debouncedSearch
    ? "没有匹配的单词"
    : isGroupFilterActive(groupFilterIds)
      ? "当前筛选条件下没有单词"
      : "还没有单词，点击右上角添加单词开始录入";

  return (
    <div className={selectMode ? "pb-24" : undefined}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">单词卡片管理</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {pageTab === "words"
              ? "单词加入复习计划后，今日复习将根据释义拼写单词"
              : "易混词对在复习拼错时可选择添加，可对比查看并加入计划"}
          </p>
        </div>
        {pageTab === "words" ? (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              data-tour="add-word"
              onClick={openAddWords}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              添加单词
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateConfusableOpen(true)}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
            >
              增加易混词卡片
            </button>
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setPageTab("words")}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            pageTab === "words"
              ? "border-violet-600 text-violet-700"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          单词卡片
        </button>
        <button
          type="button"
          onClick={() => setPageTab("confusable")}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            pageTab === "confusable"
              ? "border-rose-600 text-rose-700"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          易混词卡片
        </button>
      </div>

      {pageTab === "confusable" ? (
        <ConfusablePairsPanel />
      ) : (
        <>
      <div className="mb-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="按单词或释义搜索..."
        />
      </div>

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              总共 {words.length} 个，{inPlanCount} 个加入计划
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <MultiSelectToggleButton
                active={selectMode}
                onClick={handleToggleSelectMode}
              />
              <button
                onClick={handleJoinAll}
                disabled={bulkLoading || notInPlanCount === 0 || selectMode}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {bulkLoading ? "处理中..." : "全部加入计划"}
              </button>
              <button
                onClick={handleLeaveAll}
                disabled={bulkLoading || inPlanCount === 0 || selectMode}
                className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-600 transition hover:bg-orange-100 disabled:opacity-50"
              >
                {bulkLoading ? "处理中..." : "全部移出计划"}
              </button>
              <PageGroupFilter
                selectedIds={groupFilterIds}
                onChange={setGroupFilterIds}
                category="word"
              />
            </div>
          </div>
          {words.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-16 text-center text-slate-400 dark:text-slate-500">
              {emptyMessage}
            </div>
          ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <table className="w-full min-w-[52rem] table-fixed text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-slate-500 dark:text-slate-400">
                <tr>
                  {selectMode && (
                    <th className="w-12 px-4 py-3">
                      <SelectCheckbox
                        checked={isAllSelected(visibleIds)}
                        indeterminate={isPartiallySelected(visibleIds)}
                        onChange={() => toggleAll(visibleIds)}
                        ariaLabel="全选当前列表"
                      />
                    </th>
                  )}
                  <th className="w-14 px-4 py-3">序号</th>
                  <SortableHeader
                    label="单词"
                    direction={sortDirection}
                    active={sortField === "word"}
                    onToggle={() => handleSortToggle("word")}
                    className="w-[20rem]"
                  />
                  <th className="w-[6rem] px-4 py-3">分组</th>
                  <SortableHeader
                    label="复习 / 添加时间"
                    direction={sortDirection}
                    active={sortField === "created_at"}
                    onToggle={() => handleSortToggle("created_at")}
                    className="w-[10rem]"
                  />
                  <th className="w-[7.5rem] px-4 py-3">状态</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedWords.map((w, index) => {
                  const memoryMode = memoryModeForGroupId(w.group_id);
                  const spellState = wordTrackState(w, "spell");
                  const recState = wordTrackState(w, "recognize");
                  const spellStatusKey = getPlanCardStatus(spellState, undefined, memoryMode);
                  const recStatusKey = getPlanCardStatus(recState, undefined, memoryMode);
                  const combinedStatusKey =
                    spellStatusKey === "due_today" || recStatusKey === "due_today"
                      ? "due_today"
                      : spellStatusKey === "reviewed_today" &&
                          recStatusKey === "reviewed_today"
                        ? "reviewed_today"
                        : "upcoming";
                  const statusMeta = getPlanCardStatusMeta(
                    spellState,
                    undefined,
                    memoryMode
                  );
                  const status =
                    combinedStatusKey === "due_today"
                      ? { label: "今日未复习", className: "bg-red-100 text-red-700" }
                      : combinedStatusKey === "reviewed_today"
                        ? {
                            label: "今日已复习",
                            className: "bg-green-100 text-green-700",
                          }
                        : statusMeta;
                  return (
                    <tr
                      key={w.id}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        selectMode && selectedIds.has(w.id)
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : ""
                      }`}
                    >
                      {selectMode && (
                        <td className="px-4 py-3 align-top">
                          <SelectCheckbox
                            checked={selectedIds.has(w.id)}
                            onChange={() => toggleItem(w.id)}
                            ariaLabel={`选择 ${w.word}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 tabular-nums text-slate-400 dark:text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{w.word}</div>
                        {w.phonetic && (
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{w.phonetic}</div>
                        )}
                        {w.pos && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{w.pos}</div>
                        )}
                        <div className="mt-1">
                          <CollapsibleMeaning text={w.meaning} />
                        </div>
                        <WordExamplesDisplay word={w} />
                      </td>
                      <td className="px-4 py-3 align-top text-slate-500 dark:text-slate-400">
                        <GroupTag groupId={w.group_id} />
                      </td>
                      <td className="px-4 py-3 align-top text-slate-500 dark:text-slate-400">
                        {w.in_plan ? (
                          <div className="text-slate-600 dark:text-slate-300">
                            拼写 下次{" "}
                            {getNextReviewDate(spellState, memoryMode) ?? "—"}
                            <br />
                            认知 下次{" "}
                            {getNextReviewDate(recState, memoryMode) ?? "—"}
                          </div>
                        ) : (
                          <div className="text-slate-400 dark:text-slate-500">下次 —</div>
                        )}
                        <div className="mt-0.5 whitespace-nowrap tabular-nums text-xs text-slate-400 dark:text-slate-500">
                          添加 {formatCreatedAt(w.created_at)}
                        </div>
                        {w.in_plan && (
                          <div className="mt-0.5 text-xs text-blue-600">
                            拼写 第 {spellState.stage_index + 1}/
                            {totalStagesForGroupId(w.group_id)} 轮 · 认知 第{" "}
                            {recState.stage_index + 1}/{totalStagesForGroupId(w.group_id)} 轮
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${status.className}`}
                        >
                          {w.in_plan ? status.label : "未加入计划"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          {!selectMode && (
                            <>
                              {w.in_plan ? (
                                <IconButton
                                  title="移出复习计划"
                                  onClick={() => handleLeavePlan(w.id)}
                                  className="text-orange-600 hover:bg-orange-50"
                                >
                                  <LeavePlanIcon />
                                </IconButton>
                              ) : (
                                <IconButton
                                  title="加入复习计划"
                                  onClick={() => handleJoinPlan(w.id)}
                                  className="text-emerald-600 hover:bg-emerald-50"
                                >
                                  <JoinPlanIcon />
                                </IconButton>
                              )}
                            </>
                          )}
                          <ItemActionsMenu
                            open={openMenuId === w.id}
                            onOpenChange={(open) =>
                              setOpenMenuId(open ? w.id : null)
                            }
                            onEdit={() => openEdit(w)}
                            onDelete={() => handleDelete(w.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      <PlanMultiSelectBar
        visible={selectMode}
        selectedCount={selectedCount}
        loading={bulkLoading}
        onJoin={handleJoinSelected}
        onLeave={handleLeaveSelected}
        onEditGroup={handleEditGroupSelected}
        onDelete={handleDeleteSelected}
        onCancel={exitSelectMode}
      />

      <BulkGroupEditModal
        open={bulkGroupModalOpen}
        selectedCount={selectedCount}
        groups={wordGroups}
        loading={bulkLoading}
        error={bulkGroupError}
        onClose={() => {
          if (bulkLoading) return;
          setBulkGroupModalOpen(false);
          setBulkGroupError("");
        }}
        onConfirm={handleConfirmBulkGroup}
      />

      {batchMissingConfirmOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h3 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              部分单词未收录
            </h3>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              以下单词词典中未收录
              {batchWordsToAdd.length > 0
                ? "，继续添加将只添加其余单词，未收录的将被跳过："
                : "，继续添加将不会添加任何单词："}
            </p>
            <div className="mb-5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
              {batchMissingWords.map((word) => (
                <div
                  key={word}
                  className="font-mono text-sm text-slate-700 dark:text-slate-200"
                >
                  {word}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleBatchCancelMissing}
                disabled={batchSubmitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBatchContinueWithMissing}
                disabled={batchSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {batchSubmitting ? "添加中..." : "继续添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleBatchSubmit}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl"
          >
            <h2 className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">添加单词</h2>
            <p className="mb-4 text-sm text-slate-400 dark:text-slate-500">
              每行一个单词，将自动查词典补全音标、词性和释义
            </p>

            {batchError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {batchError}
              </p>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              单词列表
            </label>
            {batchHighlightedMissing.length > 0 && (
              <p className="mb-2 text-xs text-red-600 dark:text-red-400">
                红色标记的单词词典未收录，请修改后重试
              </p>
            )}
            <BatchWordTextarea
              value={batchText}
              onChange={(next) => {
                setBatchText(next);
                setBatchHighlightedMissing([]);
              }}
              highlightedMissing={batchHighlightedMissing}
              disabled={batchSubmitting}
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组
            </label>
            <select
              required
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={batchGroupId ?? wordGroups[0]?.id ?? ""}
              onChange={(e) => {
                setBatchGroupId(Number(e.target.value));
                setBatchStageIndex(0);
              }}
              disabled={batchSubmitting}
            >
              {wordGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={batchJoinPlan}
                onChange={(e) => setBatchJoinPlan(e.target.checked)}
                disabled={batchSubmitting}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              加入复习计划
            </label>

            {batchJoinPlan && (
              <>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  当前复习周期
                </label>
                <div className="mb-1 flex flex-wrap gap-2">
                  {batchStageOptions.map((opt) => (
                    <button
                      key={opt.index}
                      type="button"
                      onClick={() => setBatchStageIndex(opt.index)}
                      disabled={batchSubmitting}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        batchStageIndex === opt.index
                          ? "border-blue-500 bg-blue-50 font-medium text-blue-700"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mb-5 text-xs text-slate-400 dark:text-slate-500">
                  第 {batchStageIndex + 1}/{batchTotalStages} 轮
                </p>
              </>
            )}

            {!batchJoinPlan && <div className="mb-5" />}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={batchSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {batchSubmitting ? "添加中..." : "添加"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">编辑单词</h2>

            {formError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              单词
            </label>
            <input
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              required
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              音标 <span className="font-normal text-slate-400 dark:text-slate-500">（可选，留空自动查词典）</span>
            </label>
            <input
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.phonetic}
              onChange={(e) => setForm({ ...form, phonetic: e.target.value })}
              placeholder="/həˈloʊ/"
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              词性 <span className="font-normal text-slate-400 dark:text-slate-500">（可选，留空自动查词典）</span>
            </label>
            <input
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.pos}
              onChange={(e) => setForm({ ...form, pos: e.target.value })}
              placeholder="n. / v. / adj."
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              释义 <span className="font-normal text-slate-400 dark:text-slate-500">（可选，留空自动查词典）</span>
            </label>
            <textarea
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
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
              required
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.group_id || wordGroups[0]?.id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  group_id: Number(e.target.value),
                })
              }
            >
              {wordGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <div className="mb-5" />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}
        </>
      )}

      <ConfusablePairCreateModal
        open={createConfusableOpen}
        onClose={() => setCreateConfusableOpen(false)}
      />
    </div>
  );
}
