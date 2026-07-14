import { useCallback, useEffect, useMemo, useState } from "react";
import { wordApi, type WordPayload } from "../api";
import ItemActionsMenu from "../components/ItemActionsMenu";
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
import SortableHeader from "../components/SortableHeader";
import { useGroups } from "../context/GroupContext";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { getReviewStageOptions, type Word } from "../types";
import { getNextReviewDate, getPlanCardStatusMeta } from "../utils/reviewSchedule";
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
  group_id: null,
  stage_index: 0,
};

const MEANING_COLLAPSE_THRESHOLD = 48;

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

export default function WordsPage() {
  const {
    selectedGroupId,
    groups,
    memoryModeForGroupId,
    totalStagesForGroupId,
  } = useGroups();
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

  const batchMemoryMode = memoryModeForGroupId(batchGroupId);
  const batchStageOptions = useMemo(
    () => getReviewStageOptions(batchMemoryMode),
    [batchMemoryMode]
  );
  const batchTotalStages = totalStagesForGroupId(batchGroupId);

  const groupName = (id: number | null) =>
    id == null ? "无分组" : groups.find((g) => g.id === id)?.name ?? "未知分组";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wordApi.list(
        selectedGroupId,
        null,
        debouncedSearch || undefined
      );
      setWords(res.data);
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
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
        await load();
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
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const openAddWords = () => {
    setBatchText("");
    setBatchError("");
    setBatchGroupId(selectedGroupId);
    setBatchJoinPlan(true);
    setBatchStageIndex(0);
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

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wordsToAdd = parseBatchWords(batchText);
    if (wordsToAdd.length === 0) {
      setBatchError("请输入至少一个单词，每行一个");
      return;
    }

    setBatchSubmitting(true);
    setBatchError("");

    const failed: { word: string; reason: string }[] = [];
    let created = 0;

    try {
      for (const word of wordsToAdd) {
        try {
          await wordApi.create({
            word,
            phonetic: "",
            pos: "",
            meaning: "",
            example: "",
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
      } else if (failed.length > 0) {
        setBatchError(
          failed.length === 1
            ? `${failed[0].word}：${failed[0].reason}`
            : `全部添加失败，共 ${failed.length} 个`
        );
      }
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
      group_id: w.group_id,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    setFormError("");
    try {
      await wordApi.update(editingId, form);
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
    await wordApi.joinPlan(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeavePlan = async (id: number) => {
    await wordApi.leavePlan(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinAll = async () => {
    setBulkLoading(true);
    try {
      const res = await wordApi.joinPlanAll(
        selectedGroupId,
        debouncedSearch || undefined
      );
      if (res.data.count > 0) {
        await load();
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
        selectedGroupId,
        debouncedSearch || undefined
      );
      if (res.data.count > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const inPlanCount = words.filter((w) => w.in_plan).length;
  const notInPlanCount = words.length - inPlanCount;

  return (
    <div className={selectMode ? "pb-24" : undefined}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">单词卡片</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            单词加入复习计划后，今日复习将根据释义拼写单词
          </p>
        </div>
        <button
          type="button"
          onClick={openAddWords}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          添加单词
        </button>
      </div>

      <div className="mb-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="按单词或释义搜索..."
        />
      </div>

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : words.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-16 text-center text-slate-400 dark:text-slate-500">
          {debouncedSearch ? "没有匹配的单词" : "还没有单词，点击右上角添加单词开始录入"}
        </div>
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
            </div>
          </div>
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
                  const status = getPlanCardStatusMeta(w, undefined, memoryModeForGroupId(w.group_id));
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
                      </td>
                      <td className="px-4 py-3 align-top text-slate-500 dark:text-slate-400">
                        {groupName(w.group_id)}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-500 dark:text-slate-400">
                        {w.in_plan ? (
                          <div className="text-slate-600 dark:text-slate-300">
                            下次 {getNextReviewDate(w, memoryModeForGroupId(w.group_id)) ?? "—"}
                          </div>
                        ) : (
                          <div className="text-slate-400 dark:text-slate-500">下次 —</div>
                        )}
                        <div className="mt-0.5 whitespace-nowrap tabular-nums text-xs text-slate-400 dark:text-slate-500">
                          添加 {formatCreatedAt(w.created_at)}
                        </div>
                        {w.in_plan && (
                          <div className="mt-0.5 text-xs text-blue-600">
                            第 {w.stage_index + 1}/{totalStagesForGroupId(w.group_id)} 轮
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
        </>
      )}

      <PlanMultiSelectBar
        visible={selectMode}
        selectedCount={selectedCount}
        loading={bulkLoading}
        onJoin={handleJoinSelected}
        onLeave={handleLeaveSelected}
        onCancel={exitSelectMode}
      />

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
            <textarea
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 font-mono text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={8}
              placeholder={"apple\nbanana\norange"}
              disabled={batchSubmitting}
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组
            </label>
            <select
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={batchGroupId ?? ""}
              onChange={(e) => {
                const nextGroupId = e.target.value === "" ? null : Number(e.target.value);
                setBatchGroupId(nextGroupId);
                setBatchStageIndex(0);
              }}
              disabled={batchSubmitting}
            >
              <option value="">无分组</option>
              {groups.map((g) => (
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

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              例句 <span className="font-normal text-slate-400 dark:text-slate-500">（可选，留空自动查词典）</span>
            </label>
            <textarea
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.example}
              onChange={(e) => setForm({ ...form, example: e.target.value })}
              rows={2}
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组
            </label>
            <select
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
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
    </div>
  );
}
