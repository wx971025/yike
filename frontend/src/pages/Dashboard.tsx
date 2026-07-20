import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi, itemApi, wordApi, reminderApi, confusablePairApi } from "../api";
import { CardKindBadge } from "../components/CardKindBadge";
import ConfusablePairReviewCard from "../components/ConfusablePairReviewCard";
import ForgettingCurveModal from "../components/ForgettingCurveModal";
import GroupTag from "../components/GroupTag";
import PageGroupFilter from "../components/PageGroupFilter";
import WordReviewCard from "../components/WordReviewCard";
import WordReviewSettingsMenu from "../components/WordReviewSettingsMenu";
import { CurveIcon, ChevronLeftIcon, IconButton } from "../components/ItemIcons";
import { useGroups } from "../context/GroupContext";
import { type Item, type Reminder, type ReviewConfusablePair, type ReviewItem, type ReviewWord, type ReviewedTodayItem } from "../types";
import { recurrenceLabel } from "../utils/reminderSchedule";
import { sortByCreatedAt } from "../utils/sort";
import { todayStr, getNextReviewDate } from "../utils/reviewSchedule";

type WordOrderMode = "shuffle" | "created_at";

function orderWords(words: ReviewWord[], mode: WordOrderMode): ReviewWord[] {
  if (mode === "created_at") {
    return sortByCreatedAt(words, "asc");
  }
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function orderConfusablePairs(
  pairs: ReviewConfusablePair[],
  mode: WordOrderMode
): ReviewConfusablePair[] {
  if (mode === "created_at") {
    return sortByCreatedAt(pairs, "asc");
  }
  const shuffled = [...pairs];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function DueEmptyState({ kind }: { kind: "item" | "word" | "reminder" | "confusable" }) {
  const isItem = kind === "item";
  const isReminder = kind === "reminder";
  const isConfusable = kind === "confusable";
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 via-white to-amber-50/40 px-6 py-20 text-center dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30">
      <div className="text-5xl leading-none">
        {isReminder ? "✅" : isConfusable ? "🔀" : isItem ? "☁️" : "🌙"}
      </div>
      <p className="mt-4 text-base font-medium text-slate-600 dark:text-slate-300">
        {isReminder
          ? "今天没有待处理的事项"
          : isConfusable
            ? "今天没有待复习的易混词对"
          : isItem
            ? "今天没有待复习的记忆卡片"
            : "今天没有待复习的单词卡片"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400 dark:text-slate-500">
        {isReminder
          ? "事项都处理完啦，今天可以安心歇一歇～"
          : isConfusable
            ? "易混词也都对齐啦，今天就让自己慢慢晃悠吧～"
          : isItem
            ? "慵懒一下也没关系，脑子也需要放空的时刻～"
            : "单词也都歇着啦，今天就让自己慢慢晃悠吧～"}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { totalStagesForGroupId, memoryModeForGroupId } = useGroups();
  const [dueItemGroupFilterIds, setDueItemGroupFilterIds] = useState<Set<number>>(
    new Set()
  );
  const [dueWordGroupFilterIds, setDueWordGroupFilterIds] = useState<Set<number>>(
    new Set()
  );
  const [statsGroupFilterIds, setStatsGroupFilterIds] = useState<Set<number>>(
    new Set()
  );
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [completed, setCompleted] = useState<ReviewedTodayItem[]>([]);
  const [completedStats, setCompletedStats] = useState({ total: 0, item_count: 0, word_count: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"due" | "stats">("due");
  const [dueSubTab, setDueSubTab] = useState<"item" | "word" | "confusable" | "reminder">("item");
  const [wordOrderMode, setWordOrderMode] = useState<WordOrderMode>("shuffle");
  const [wordQueue, setWordQueue] = useState<ReviewWord[]>([]);
  const [wordHistory, setWordHistory] = useState<ReviewWord[]>([]);
  const [confusablePairs, setConfusablePairs] = useState<ReviewConfusablePair[]>([]);
  const [confusableQueue, setConfusableQueue] = useState<ReviewConfusablePair[]>([]);
  const [curveItem, setCurveItem] = useState<Item | null>(null);
  const [reviewToast, setReviewToast] = useState<string | null>(null);
  const wordSessionTotalRef = useRef(0);
  const confusableSessionTotalRef = useRef(0);

  const loadDueItems = useCallback(async () => {
    const res = await reviewApi.today(dueItemGroupFilterIds);
    setItems(res.data);
  }, [dueItemGroupFilterIds]);

  const loadDueWords = useCallback(async () => {
    const res = await reviewApi.todayWords(dueWordGroupFilterIds);
    setWords(res.data);
  }, [dueWordGroupFilterIds]);

  const loadDueReminders = useCallback(async () => {
    const res = await reminderApi.today();
    setReminders(res.data);
  }, []);

  const loadDueConfusablePairs = useCallback(async () => {
    const res = await reviewApi.todayConfusablePairs();
    setConfusablePairs(res.data);
  }, []);

  const loadCompleted = useCallback(async () => {
    const res = await reviewApi.todayCompleted(statsGroupFilterIds);
    setCompleted(res.data.items);
    setCompletedStats({
      total: res.data.total,
      item_count: res.data.item_count,
      word_count: res.data.word_count,
    });
  }, [statsGroupFilterIds]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      await Promise.all([
        loadDueItems(),
        loadDueWords(),
        loadDueConfusablePairs(),
        loadDueReminders(),
        loadCompleted(),
      ]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadDueItems, loadDueWords, loadDueConfusablePairs, loadDueReminders, loadCompleted]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load({ silent: true });
    };
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  useEffect(() => {
    wordSessionTotalRef.current = 0;
    setWordQueue([]);
    setWordHistory([]);
  }, [dueWordGroupFilterIds]);

  useEffect(() => {
    confusableSessionTotalRef.current = 0;
    setConfusableQueue([]);
  }, []);

  useEffect(() => {
    wordSessionTotalRef.current = Math.max(wordSessionTotalRef.current, words.length);
  }, [words.length]);

  useEffect(() => {
    confusableSessionTotalRef.current = Math.max(
      confusableSessionTotalRef.current,
      confusablePairs.length
    );
  }, [confusablePairs.length]);

  useEffect(() => {
    setWordQueue((prev) => {
      const available = new Map(words.map((w) => [w.id, w]));
      const kept = prev
        .filter((w) => available.has(w.id))
        .map((w) => available.get(w.id)!);
      if (kept.length > 0) return kept;
      return orderWords(words, wordOrderMode);
    });
  }, [words]);

  useEffect(() => {
    setWordQueue(orderWords(words, wordOrderMode));
    setWordHistory([]);
  }, [wordOrderMode]);

  useEffect(() => {
    setConfusableQueue((prev) => {
      const available = new Map(confusablePairs.map((pair) => [pair.id, pair]));
      const kept = prev
        .filter((pair) => available.has(pair.id))
        .map((pair) => available.get(pair.id)!);
      if (kept.length > 0) return kept;
      return orderConfusablePairs(confusablePairs, wordOrderMode);
    });
  }, [confusablePairs]);

  useEffect(() => {
    setConfusableQueue(orderConfusablePairs(confusablePairs, wordOrderMode));
  }, [wordOrderMode]);

  useEffect(() => {
    if (!reviewToast) return;
    const timer = window.setTimeout(() => setReviewToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [reviewToast]);

  const itemCount = items.length;
  const wordCount = wordQueue.length;
  const confusableCount = confusableQueue.length;
  const reminderCount = reminders.length;
  const isWordReviewActive =
    activeTab === "due" && dueSubTab === "word" && wordCount > 0;
  const isConfusableReviewActive =
    activeTab === "due" && dueSubTab === "confusable" && confusableCount > 0;
  const isSpellReviewActive = isWordReviewActive || isConfusableReviewActive;

  const handleReminderDone = async (id: number) => {
    const reminder = reminders.find((item) => item.id === id);
    await reminderApi.done(id);
    if (reminder) setReviewToast(`${reminder.title} 已完成`);
    setReminders((prev) => prev.filter((item) => item.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleCardReview = async (id: number) => {
    const item = items.find((it) => it.id === id);
    await itemApi.review(id);
    if (item) setReviewToast(`${item.title} 已复习`);
    setItems((prev) => prev.filter((it) => it.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleCardSkip = async (id: number) => {
    await itemApi.skip(id);
    setItems((prev) => prev.filter((it) => it.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const pushWordHistory = (word: ReviewWord) => {
    setWordHistory((prev) => [...prev, word]);
  };

  const handleWordPrevious = () => {
    setWordHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setWordQueue((queue) => {
        if (queue.length === 0) return [previous];
        const [current, ...rest] = queue;
        const restWithoutPrev = rest.filter((w) => w.id !== previous.id);
        return current
          ? [previous, current, ...restWithoutPrev]
          : [previous, ...restWithoutPrev];
      });
      return prev.slice(0, -1);
    });
  };

  const handleWordReview = async (id: number) => {
    const current = wordQueue[0];
    if (current?.id === id) pushWordHistory(current);
    await wordApi.review(id);
    setWords((prev) => prev.filter((w) => w.id !== id));
    setWordQueue((prev) => prev.filter((w) => w.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleWordSkip = async (id: number) => {
    const current = wordQueue[0];
    if (current?.id === id) pushWordHistory(current);
    await wordApi.skip(id);
    setWords((prev) => prev.filter((w) => w.id !== id));
    setWordQueue((prev) => prev.filter((w) => w.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleWordDefer = (id: number) => {
    const current = wordQueue[0];
    if (current?.id === id) pushWordHistory(current);
    setWordQueue((prev) => {
      const index = prev.findIndex((w) => w.id === id);
      if (index < 0) return prev;
      const next = [...prev];
      const [word] = next.splice(index, 1);
      next.push(word);
      return next;
    });
  };

  const handleWordUpdated = useCallback((updated: ReviewWord) => {
    const patch = (word: ReviewWord): ReviewWord =>
      word.id === updated.id ? updated : word;
    setWords((prev) => prev.map(patch));
    setWordQueue((prev) => prev.map(patch));
  }, []);

  const handleWordPeekReset = useCallback(async (id: number) => {
    try {
      const res = await wordApi.resetStage(id);
      const updated = res.data;
      const today = todayStr();
      const dueDate =
        getNextReviewDate(updated, memoryModeForGroupId(updated.group_id)) ?? today;
      const patchWord = (word: ReviewWord): ReviewWord =>
        word.id === id
          ? {
              ...word,
              ...updated,
              stage_index: 0,
              learned_at: updated.learned_at ?? today,
              status: updated.status,
              last_reviewed_at: null,
              due_date: dueDate,
              overdue_days: 0,
            }
          : word;
      setWords((prev) => prev.map(patchWord));
      setWordQueue((prev) => prev.map(patchWord));
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } catch {
      // 重置失败不阻断当前复习流程
    }
  }, [memoryModeForGroupId]);

  const handleConfusableReview = async (id: number) => {
    await confusablePairApi.review(id);
    setConfusablePairs((prev) => prev.filter((pair) => pair.id !== id));
    setConfusableQueue((prev) => prev.filter((pair) => pair.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleConfusableSkip = async (id: number) => {
    await confusablePairApi.skip(id);
    setConfusablePairs((prev) => prev.filter((pair) => pair.id !== id));
    setConfusableQueue((prev) => prev.filter((pair) => pair.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleConfusableDelete = async (id: number) => {
    await confusablePairApi.remove(id);
    setConfusablePairs((prev) => prev.filter((pair) => pair.id !== id));
    setConfusableQueue((prev) => prev.filter((pair) => pair.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleConfusablePairUpdated = useCallback((updated: ReviewConfusablePair) => {
    const patch = (pair: ReviewConfusablePair): ReviewConfusablePair =>
      pair.id === updated.id ? updated : pair;
    setConfusablePairs((prev) => prev.map(patch));
    setConfusableQueue((prev) => prev.map(patch));
  }, []);

  const completedItems = completed.filter((entry) => entry.kind === "item");
  const completedWords = completed.filter((entry) => entry.kind === "word");

  const renderCompletedEntry = (entry: ReviewedTodayItem) => (
    <div
      key={`${entry.kind}-${entry.id}`}
      className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/50 px-4 py-3"
    >
      <span className="text-green-600">✓</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <CardKindBadge kind={entry.kind} />
          <GroupTag groupId={entry.group_id} className="ml-0" />
        </div>
        <p className="truncate font-medium text-slate-800 dark:text-slate-100">{entry.title}</p>
      </div>
      <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
        第 {entry.stage}/{totalStagesForGroupId(entry.group_id)} 轮
      </span>
    </div>
  );

  return (
    <div
      className={
        isSpellReviewActive
          ? "flex min-h-[calc(100vh-10rem)] flex-col"
          : undefined
      }
    >
      {reviewToast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 shadow-lg dark:border-green-800 dark:bg-green-950/90 dark:text-green-200">
            <span className="mr-1.5 text-green-600 dark:text-green-400">✓</span>
            {reviewToast}
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">今日复习</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            根据分组记忆方式，查看今天待复习和已复习的内容
          </p>
        </div>
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab("due")}
          className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "due"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          待复习
          {(itemCount > 0 || wordCount > 0 || confusableCount > 0) && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "due" ? "bg-blue-100 text-blue-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {itemCount + wordCount + confusableCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("stats")}
          className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "stats"
              ? "border-green-600 text-green-700"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
        >
          复习统计
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "stats" ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
            }`}
          >
            {completedStats.total}
          </span>
        </button>
      </div>

      {activeTab === "due" ? (
        <div className={isSpellReviewActive ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDueSubTab("item")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                dueSubTab === "item"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              记忆卡片
              {itemCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500" title={`${itemCount} 张待复习`} />
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  dueSubTab === "item" ? "bg-blue-200 text-blue-800" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                }`}
              >
                {itemCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDueSubTab("word")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                dueSubTab === "word"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              单词卡片
              {wordCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500" title={`${wordCount} 个待复习`} />
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  dueSubTab === "word" ? "bg-violet-200 text-violet-800" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                }`}
              >
                {wordCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDueSubTab("confusable")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                dueSubTab === "confusable"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              易混词
              {confusableCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500" title={`${confusableCount} 对待复习`} />
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  dueSubTab === "confusable"
                    ? "bg-rose-200 text-rose-800"
                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                }`}
              >
                {confusableCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDueSubTab("reminder")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                dueSubTab === "reminder"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              事项卡片
              {reminderCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500" title={`${reminderCount} 个待处理`} />
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  dueSubTab === "reminder"
                    ? "bg-amber-200 text-amber-900"
                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                }`}
              >
                {reminderCount}
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              {dueSubTab === "item" ? (
                <PageGroupFilter
                  selectedIds={dueItemGroupFilterIds}
                  onChange={setDueItemGroupFilterIds}
                  category="memory_card"
                />
              ) : dueSubTab === "word" || dueSubTab === "confusable" ? (
                <WordReviewSettingsMenu
                  showWordOrder={dueSubTab === "confusable"}
                  wordOrderMode={wordOrderMode}
                  onToggleWordOrder={() =>
                    setWordOrderMode((mode) =>
                      mode === "shuffle" ? "created_at" : "shuffle"
                    )
                  }
                />
              ) : null}
              {dueSubTab === "word" ? (
                <PageGroupFilter
                  selectedIds={dueWordGroupFilterIds}
                  onChange={setDueWordGroupFilterIds}
                  category="word"
                />
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="text-slate-400 dark:text-slate-500">加载中...</p>
          ) : dueSubTab === "item" ? (
            itemCount === 0 ? (
              <DueEmptyState kind="item" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={`card-${item.id}`}
                    className={`relative rounded-2xl border p-4 pr-12 ${
                      item.overdue_days > 0
                        ? "border-red-300 ring-1 ring-red-200/80 dark:ring-red-900/50"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <IconButton
                      title="遗忘曲线"
                      onClick={() => setCurveItem(item)}
                      className="absolute right-2 top-2 text-indigo-600 hover:bg-indigo-50"
                    >
                      <CurveIcon />
                    </IconButton>

                    <div className="mb-1">
                      <CardKindBadge kind="item" />
                      <GroupTag groupId={item.group_id} className="ml-2" />
                    </div>
                    <h3 className="mb-1 mt-2 font-semibold text-slate-800 dark:text-slate-100">{item.title}</h3>
                    {item.description && (
                      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                    )}
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
                        第 {item.stage_index + 1}/{totalStagesForGroupId(item.group_id)} 轮
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">应复习于 {item.due_date}</span>
                      {item.overdue_days > 0 && (
                        <span className="font-medium text-red-500">
                          逾期 {item.overdue_days} 天
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCardReview(item.id)}
                        className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                      >
                        已复习
                      </button>
                      <button
                        onClick={() => handleCardSkip(item.id)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        跳过
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : dueSubTab === "word" ? (
            wordCount === 0 ? (
            <DueEmptyState kind="word" />
          ) : (
            <div className={isWordReviewActive ? "flex min-h-0 flex-1 flex-col" : undefined}>
            <div
              className={`flex gap-2 ${
                isWordReviewActive ? "min-h-0 flex-1 items-stretch" : "items-center"
              }`}
            >
              <button
                type="button"
                onClick={handleWordPrevious}
                disabled={wordHistory.length === 0}
                title="上一个单词"
                aria-label="上一个单词"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <ChevronLeftIcon />
              </button>
              <div
                className={
                  isWordReviewActive ? "flex min-h-0 min-w-0 flex-1 flex-col" : "min-w-0 flex-1"
                }
              >
            <WordReviewCard
              word={wordQueue[0]}
              groupId={wordQueue[0].group_id}
              currentIndex={wordSessionTotalRef.current - wordQueue.length}
              totalCount={Math.max(wordSessionTotalRef.current, wordQueue.length)}
              wordOrderMode={wordOrderMode}
              onToggleWordOrder={() =>
                setWordOrderMode((mode) =>
                  mode === "shuffle" ? "created_at" : "shuffle"
                )
              }
              onReviewed={handleWordReview}
              onSkip={handleWordSkip}
              onDefer={handleWordDefer}
              onPeekAnswer={handleWordPeekReset}
              onWordUpdated={handleWordUpdated}
            />
              </div>
            </div>
            </div>
          )
        ) : dueSubTab === "confusable" ? (
          confusableCount === 0 ? (
            <DueEmptyState kind="confusable" />
          ) : (
            <div className={isConfusableReviewActive ? "flex min-h-0 flex-1 flex-col" : undefined}>
              <ConfusablePairReviewCard
                pair={confusableQueue[0]}
                currentIndex={
                  confusableSessionTotalRef.current - confusableQueue.length
                }
                totalCount={Math.max(
                  confusableSessionTotalRef.current,
                  confusableQueue.length
                )}
                onReviewed={handleConfusableReview}
                onSkip={handleConfusableSkip}
                onDelete={handleConfusableDelete}
                onPairUpdated={handleConfusablePairUpdated}
              />
            </div>
          )
        ) : reminderCount === 0 ? (
            <DueEmptyState kind="reminder" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reminders.map((reminder) => (
                <div
                  key={`reminder-${reminder.id}`}
                  className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
                >
                  <div className="mb-1">
                    <CardKindBadge kind="reminder" />
                  </div>
                  <h3 className="mb-2 mt-2 font-semibold text-slate-800 dark:text-slate-100">
                    {reminder.title}
                  </h3>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                      提醒于 {reminder.remind_date}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {recurrenceLabel(reminder.recurrence)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleReminderDone(reminder.id)}
                    className="w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    完成
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <PageGroupFilter
              selectedIds={statsGroupFilterIds}
              onChange={setStatsGroupFilterIds}
              category={["memory_card", "word"]}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex max-h-[calc(100vh-14rem)] min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">记忆卡片</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {completedStats.item_count}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {completedItems.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">今天还没有复习记忆卡片</p>
              ) : (
                completedItems.map(renderCompletedEntry)
              )}
            </div>
          </div>

          <div className="flex max-h-[calc(100vh-14rem)] min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">单词卡片</h3>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                {completedStats.word_count}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {completedWords.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">今天还没有复习单词卡片</p>
              ) : (
                completedWords.map(renderCompletedEntry)
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {curveItem && (
        <ForgettingCurveModal item={curveItem} onClose={() => setCurveItem(null)} />
      )}
    </div>
  );
}
