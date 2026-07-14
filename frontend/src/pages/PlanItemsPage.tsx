import { useCallback, useEffect, useMemo, useState } from "react";
import { itemApi, wordApi } from "../api";
import ForgettingCurveModal from "../components/ForgettingCurveModal";
import PageGroupFilter from "../components/PageGroupFilter";
import PlanMultiSelectBar, {
  MultiSelectToggleButton,
  SelectCheckbox,
} from "../components/PlanMultiSelectBar";
import {
  CurveIcon,
  EditIcon,
  IconButton,
  LeavePlanIcon,
} from "../components/ItemIcons";
import SearchBox from "../components/SearchBox";
import SortableHeader from "../components/SortableHeader";
import { useGroups } from "../context/GroupContext";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { getReviewStageOptions, type Item, type Word } from "../types";
import { getNextReviewDate, getPlanCardStatusMeta } from "../utils/reviewSchedule";
import {
  sortByNextReviewDate,
  sortByTitle,
  sortByWord,
  toggleSortDirection,
  type SortDirection,
} from "../utils/sort";

type PlanTab = "item" | "word";

export default function PlanItemsPage() {
  const {
    selectedGroupId,
    groups,
    memoryModeForGroupId,
    totalStagesForGroupId,
  } = useGroups();
  const [activeTab, setActiveTab] = useState<PlanTab>("item");
  const [items, setItems] = useState<Item[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [curveItem, setCurveItem] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [itemSortField, setItemSortField] = useState<
    "title" | "next_review_date"
  >("next_review_date");
  const [wordSortField, setWordSortField] = useState<
    "word" | "next_review_date"
  >("next_review_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [stageSavingId, setStageSavingId] = useState<number | null>(null);
  const [stageEditItem, setStageEditItem] = useState<Item | null>(null);
  const [stageEditWord, setStageEditWord] = useState<Word | null>(null);
  const [stageDraft, setStageDraft] = useState(0);
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

  const groupName = (id: number | null) =>
    id == null ? "无分组" : groups.find((g) => g.id === id)?.name ?? "未知分组";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadItems = useCallback(async () => {
    const res = await itemApi.list(
      selectedGroupId,
      true,
      debouncedSearch || undefined
    );
    setItems(res.data);
  }, [selectedGroupId, debouncedSearch]);

  const loadWords = useCallback(async () => {
    const res = await wordApi.list(
      selectedGroupId,
      true,
      debouncedSearch || undefined
    );
    setWords(res.data);
  }, [selectedGroupId, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadItems(), loadWords()]);
    } finally {
      setLoading(false);
    }
  }, [loadItems, loadWords]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleItemSortToggle = (field: "title" | "next_review_date") => {
    if (itemSortField === field) {
      setSortDirection(toggleSortDirection(sortDirection));
    } else {
      setItemSortField(field);
      setSortDirection("asc");
    }
  };

  const handleWordSortToggle = (field: "word" | "next_review_date") => {
    if (wordSortField === field) {
      setSortDirection(toggleSortDirection(sortDirection));
    } else {
      setWordSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo((): Item[] => {
    if (itemSortField === "next_review_date") {
      return sortByNextReviewDate(items, sortDirection, (item) =>
        memoryModeForGroupId(item.group_id)
      );
    }
    return sortByTitle(items, sortDirection);
  }, [items, itemSortField, sortDirection, memoryModeForGroupId]);

  const sortedWords = useMemo((): Word[] => {
    if (wordSortField === "next_review_date") {
      return sortByNextReviewDate(words, sortDirection, (word) =>
        memoryModeForGroupId(word.group_id)
      );
    }
    return sortByWord(words, sortDirection);
  }, [words, wordSortField, sortDirection, memoryModeForGroupId]);

  const visibleIds = useMemo(() => {
    if (activeTab === "item") {
      return sortedItems.map((item) => item.id);
    }
    return sortedWords.map((word) => word.id);
  }, [activeTab, sortedItems, sortedWords]);

  useEffect(() => {
    exitSelectMode();
  }, [activeTab, exitSelectMode]);

  const stageEditOptions = useMemo(
    () => {
      const target = stageEditItem ?? stageEditWord;
      if (!target) return [];
      return getReviewStageOptions(memoryModeForGroupId(target.group_id));
    },
    [stageEditItem, stageEditWord, memoryModeForGroupId]
  );

  const handleLeaveItemPlan = async (id: number) => {
    await itemApi.leavePlan(id);
    await loadItems();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeaveWordPlan = async (id: number) => {
    await wordApi.leavePlan(id);
    await loadWords();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeaveAll = async () => {
    setBulkLoading(true);
    try {
      if (activeTab === "item") {
        const res = await itemApi.leavePlanAll(
          selectedGroupId,
          debouncedSearch || undefined
        );
        if (res.data.count > 0) {
          await loadItems();
          window.dispatchEvent(new CustomEvent("app-data-changed"));
        }
      } else {
        const res = await wordApi.leavePlanAll(
          selectedGroupId,
          debouncedSearch || undefined
        );
        if (res.data.count > 0) {
          await loadWords();
          window.dispatchEvent(new CustomEvent("app-data-changed"));
        }
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveSelected = async () => {
    if (selectedCount === 0) return;
    setBulkLoading(true);
    try {
      if (activeTab === "item") {
        const targets = sortedItems.filter((item) => selectedIds.has(item.id));
        for (const item of targets) {
          await itemApi.leavePlan(item.id);
        }
        if (targets.length > 0) {
          await loadItems();
          window.dispatchEvent(new CustomEvent("app-data-changed"));
        }
      } else {
        const targets = sortedWords.filter((word) => selectedIds.has(word.id));
        for (const word of targets) {
          await wordApi.leavePlan(word.id);
        }
        if (targets.length > 0) {
          await loadWords();
          window.dispatchEvent(new CustomEvent("app-data-changed"));
        }
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleItemStageChange = async (item: Item, stageIndex: number) => {
    if (item.stage_index === stageIndex) return;
    setStageSavingId(item.id);
    try {
      await itemApi.update(item.id, { stage_index: stageIndex });
      await loadItems();
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } finally {
      setStageSavingId(null);
    }
  };

  const handleWordStageChange = async (word: Word, stageIndex: number) => {
    if (word.stage_index === stageIndex) return;
    setStageSavingId(word.id);
    try {
      await wordApi.update(word.id, { stage_index: stageIndex });
      await loadWords();
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } finally {
      setStageSavingId(null);
    }
  };

  const openItemStageEdit = (item: Item) => {
    setStageEditWord(null);
    setStageEditItem(item);
    setStageDraft(item.stage_index);
  };

  const openWordStageEdit = (word: Word) => {
    setStageEditItem(null);
    setStageEditWord(word);
    setStageDraft(word.stage_index);
  };

  const handleStageSave = async () => {
    if (stageEditItem) {
      await handleItemStageChange(stageEditItem, stageDraft);
      setStageEditItem(null);
      return;
    }
    if (stageEditWord) {
      await handleWordStageChange(stageEditWord, stageDraft);
      setStageEditWord(null);
    }
  };

  const stageEditTarget = stageEditItem ?? stageEditWord;
  const currentCount = activeTab === "item" ? items.length : words.length;
  const searchPlaceholder =
    activeTab === "item" ? "按标题搜索卡片..." : "按单词或释义搜索...";
  const emptyMessage = debouncedSearch
    ? activeTab === "item"
      ? "没有匹配的计划卡片"
      : "没有匹配的计划单词"
    : activeTab === "item"
      ? "还没有加入复习计划的普通卡片，可在「普通卡片」页加入计划"
      : "还没有加入复习计划的单词，可在「单词卡片」页加入计划";

  return (
    <div className={selectMode ? "pb-24" : undefined}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            计划管理
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            管理已加入复习计划的普通卡片与单词，只有在此列表中的内容才会收到复习提醒
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <PageGroupFilter />
          <button
            onClick={handleLeaveAll}
            disabled={bulkLoading || currentCount === 0 || selectMode}
            className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
          >
            {bulkLoading ? "处理中..." : "全部移除"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("item")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "item"
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          普通卡片
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "item"
                ? "bg-blue-200 text-blue-800"
                : "bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            {items.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("word")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "word"
              ? "bg-violet-100 text-violet-700"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          单词卡片
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "word"
                ? "bg-violet-200 text-violet-800"
                : "bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            {words.length}
          </span>
        </button>
      </div>

      <div className="mb-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
        />
      </div>

      {!loading && currentCount > 0 && (
        <div className="mb-2 flex items-center justify-end">
          <MultiSelectToggleButton
            active={selectMode}
            onClick={toggleSelectMode}
          />
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : currentCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500">
          {emptyMessage}
        </div>
      ) : activeTab === "item" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
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
                <SortableHeader
                  label="标题"
                  direction={sortDirection}
                  active={itemSortField === "title"}
                  onToggle={() => handleItemSortToggle("title")}
                />
                <th className="px-4 py-3">分组</th>
                <SortableHeader
                  label="下次学习日期"
                  direction={sortDirection}
                  active={itemSortField === "next_review_date"}
                  onToggle={() => handleItemSortToggle("next_review_date")}
                />
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const status = getPlanCardStatusMeta(
                  item,
                  undefined,
                  memoryModeForGroupId(item.group_id)
                );
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      selectMode && selectedIds.has(item.id)
                        ? "bg-blue-50/50 dark:bg-blue-950/20"
                        : ""
                    }`}
                  >
                    {selectMode && (
                      <td className="px-4 py-3">
                        <SelectCheckbox
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          ariaLabel={`选择 ${item.title}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {groupName(item.group_id)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {getNextReviewDate(item, memoryModeForGroupId(item.group_id)) ??
                        "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <span className="text-slate-500 dark:text-slate-400">
                          第 {item.stage_index + 1}/
                          {totalStagesForGroupId(item.group_id)} 轮
                        </span>
                        <IconButton
                          title="编辑进度"
                          onClick={() => openItemStageEdit(item)}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          <EditIcon />
                        </IconButton>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!selectMode && (
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton
                            title="遗忘曲线"
                            onClick={() => setCurveItem(item)}
                            className="text-indigo-600 hover:bg-indigo-50"
                          >
                            <CurveIcon />
                          </IconButton>
                          <IconButton
                            title="移出复习计划"
                            onClick={() => handleLeaveItemPlan(item.id)}
                            className="text-orange-600 hover:bg-orange-50"
                          >
                            <LeavePlanIcon />
                          </IconButton>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
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
                <SortableHeader
                  label="单词"
                  direction={sortDirection}
                  active={wordSortField === "word"}
                  onToggle={() => handleWordSortToggle("word")}
                />
                <th className="px-4 py-3">分组</th>
                <SortableHeader
                  label="下次学习日期"
                  direction={sortDirection}
                  active={wordSortField === "next_review_date"}
                  onToggle={() => handleWordSortToggle("next_review_date")}
                />
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedWords.map((word) => {
                const status = getPlanCardStatusMeta(
                  word,
                  undefined,
                  memoryModeForGroupId(word.group_id)
                );
                return (
                  <tr
                    key={word.id}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      selectMode && selectedIds.has(word.id)
                        ? "bg-blue-50/50 dark:bg-blue-950/20"
                        : ""
                    }`}
                  >
                    {selectMode && (
                      <td className="px-4 py-3">
                        <SelectCheckbox
                          checked={selectedIds.has(word.id)}
                          onChange={() => toggleItem(word.id)}
                          ariaLabel={`选择 ${word.word}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {word.word}
                      </div>
                      {word.phonetic && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {word.phonetic}
                        </div>
                      )}
                      {word.meaning && (
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          {word.meaning}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {groupName(word.group_id)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {getNextReviewDate(word, memoryModeForGroupId(word.group_id)) ??
                        "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <span className="text-slate-500 dark:text-slate-400">
                          第 {word.stage_index + 1}/
                          {totalStagesForGroupId(word.group_id)} 轮
                        </span>
                        <IconButton
                          title="编辑进度"
                          onClick={() => openWordStageEdit(word)}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          <EditIcon />
                        </IconButton>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!selectMode && (
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton
                            title="移出复习计划"
                            onClick={() => handleLeaveWordPlan(word.id)}
                            className="text-orange-600 hover:bg-orange-50"
                          >
                            <LeavePlanIcon />
                          </IconButton>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PlanMultiSelectBar
        visible={selectMode}
        selectedCount={selectedCount}
        loading={bulkLoading}
        onLeave={handleLeaveSelected}
        leaveLabel="移除"
        onCancel={exitSelectMode}
      />

      {curveItem && (
        <ForgettingCurveModal item={curveItem} onClose={() => setCurveItem(null)} />
      )}

      {stageEditTarget && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            setStageEditItem(null);
            setStageEditWord(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">
              编辑进度
            </h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {stageEditItem?.title ?? stageEditWord?.word}
            </p>
            <div className="mb-5 flex flex-wrap gap-2">
              {stageEditOptions.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  onClick={() => setStageDraft(opt.index)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    stageDraft === opt.index
                      ? "border-blue-500 bg-blue-50 font-medium text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  第 {opt.index + 1} 轮 · {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setStageEditItem(null);
                  setStageEditWord(null);
                }}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleStageSave}
                disabled={stageSavingId === stageEditTarget.id}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {stageSavingId === stageEditTarget.id ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
