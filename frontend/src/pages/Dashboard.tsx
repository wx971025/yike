import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi, itemApi, wordApi } from "../api";
import { CardKindBadge } from "../components/CardKindBadge";
import ForgettingCurveModal from "../components/ForgettingCurveModal";
import PageGroupFilter from "../components/PageGroupFilter";
import WordReviewCard from "../components/WordReviewCard";
import { CurveIcon, IconButton } from "../components/ItemIcons";
import { useGroups } from "../context/GroupContext";
import { useWordReviewUi } from "../context/WordReviewUiContext";
import { type Item, type ReviewItem, type ReviewWord, type ReviewedTodayItem } from "../types";
import { sortByCreatedAt } from "../utils/sort";

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

function DueEmptyState({ kind }: { kind: "item" | "word" }) {
  const isItem = kind === "item";
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 via-white to-amber-50/40 px-6 py-20 text-center dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30">
      <div className="text-5xl leading-none">{isItem ? "☁️" : "🌙"}</div>
      <p className="mt-4 text-base font-medium text-slate-600 dark:text-slate-300">
        {isItem ? "今天没有待复习的普通卡片" : "今天没有待复习的单词卡片"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400 dark:text-slate-500">
        {isItem
          ? "慵懒一下也没关系，脑子也需要放空的时刻～"
          : "单词也都歇着啦，今天就让自己慢慢晃悠吧～"}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { selectedGroupId, groups, totalStagesForGroupId } = useGroups();
  const {
    keyboardSoundEnabled,
    setKeyboardSoundEnabled,
    focusMode,
    setFocusMode,
  } = useWordReviewUi();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [completed, setCompleted] = useState<ReviewedTodayItem[]>([]);
  const [completedStats, setCompletedStats] = useState({ total: 0, item_count: 0, word_count: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"due" | "stats">("due");
  const [dueSubTab, setDueSubTab] = useState<"item" | "word">("item");
  const [wordOrderMode, setWordOrderMode] = useState<WordOrderMode>("shuffle");
  const [wordQueue, setWordQueue] = useState<ReviewWord[]>([]);
  const [curveItem, setCurveItem] = useState<Item | null>(null);
  const [reviewToast, setReviewToast] = useState<string | null>(null);
  const wordSessionTotalRef = useRef(0);

  const groupName = (id: number | null) =>
    id == null ? "无分组" : groups.find((g) => g.id === id)?.name ?? "未知分组";

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const [cardsRes, wordsRes, completedRes] = await Promise.all([
        reviewApi.today(selectedGroupId),
        reviewApi.todayWords(selectedGroupId),
        reviewApi.todayCompleted(selectedGroupId),
      ]);
      setItems(cardsRes.data);
      setWords(wordsRes.data);
      setCompleted(completedRes.data.items);
      setCompletedStats({
        total: completedRes.data.total,
        item_count: completedRes.data.item_count,
        word_count: completedRes.data.word_count,
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedGroupId]);

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
  }, [selectedGroupId]);

  useEffect(() => {
    wordSessionTotalRef.current = Math.max(wordSessionTotalRef.current, words.length);
  }, [words.length]);

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
  }, [wordOrderMode]);

  useEffect(() => {
    if (dueSubTab !== "word" || wordQueue.length === 0) {
      setFocusMode(false);
    }
  }, [dueSubTab, wordQueue.length, setFocusMode]);

  useEffect(() => {
    if (!reviewToast) return;
    const timer = window.setTimeout(() => setReviewToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [reviewToast]);

  const itemCount = items.length;
  const wordCount = wordQueue.length;

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

  const handleWordReview = async (id: number) => {
    await wordApi.review(id);
    setWords((prev) => prev.filter((w) => w.id !== id));
    setWordQueue((prev) => prev.filter((w) => w.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleWordSkip = async (id: number) => {
    await wordApi.skip(id);
    setWords((prev) => prev.filter((w) => w.id !== id));
    setWordQueue((prev) => prev.filter((w) => w.id !== id));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleWordDefer = (id: number) => {
    setWordQueue((prev) => {
      const index = prev.findIndex((w) => w.id === id);
      if (index < 0) return prev;
      const next = [...prev];
      const [word] = next.splice(index, 1);
      next.push(word);
      return next;
    });
  };

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
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
            {groupName(entry.group_id)}
          </span>
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
        focusMode && activeTab === "due" && dueSubTab === "word" && wordCount > 0
          ? "flex min-h-0 flex-1 flex-col"
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

      {!focusMode && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">今日复习</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              根据分组记忆方式，查看今天待复习和已复习的内容
            </p>
          </div>
          <PageGroupFilter />
        </div>
      )}

      {!focusMode && (
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
          {(itemCount > 0 || wordCount > 0) && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "due" ? "bg-blue-100 text-blue-700" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {itemCount + wordCount}
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
      )}

      {activeTab === "due" ? (
        <>
          {!focusMode && (
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
              普通卡片
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
            {dueSubTab === "word" && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setWordOrderMode((mode) =>
                      mode === "shuffle" ? "created_at" : "shuffle"
                    )
                  }
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    wordOrderMode === "shuffle"
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={
                    wordOrderMode === "shuffle"
                      ? "当前乱序，点击按添加时间排序"
                      : "当前按添加时间，点击切换乱序"
                  }
                >
                  <span aria-hidden>{wordOrderMode === "shuffle" ? "🔀" : "🕒"}</span>
                  {wordOrderMode === "shuffle" ? "乱序" : "顺序"}
                </button>
                <button
                  type="button"
                  onClick={() => setKeyboardSoundEnabled(!keyboardSoundEnabled)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    keyboardSoundEnabled
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={keyboardSoundEnabled ? "点击关闭键盘音" : "点击开启键盘音"}
                >
                  <span aria-hidden>{keyboardSoundEnabled ? "🔊" : "🔇"}</span>
                  {keyboardSoundEnabled ? "键盘音" : "静音"}
                </button>
                {wordCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFocusMode(!focusMode)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      focusMode
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                    title={focusMode ? "退出放大模式" : "放大复习区域，隐藏无关元素"}
                  >
                    <span aria-hidden>{focusMode ? "↙" : "⛶"}</span>
                    {focusMode ? "退出放大" : "放大"}
                  </button>
                )}
              </div>
            )}
          </div>
          )}

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
                    className={`relative rounded-2xl border bg-white dark:bg-slate-900 p-4 pr-12 shadow-sm ${
                      item.overdue_days > 0 ? "border-red-300" : "border-slate-200 dark:border-slate-700"
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
                      <span className="ml-2 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {groupName(item.group_id)}
                      </span>
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
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        跳过
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : wordCount === 0 ? (
            <DueEmptyState kind="word" />
          ) : (
            <div className={focusMode ? "flex min-h-0 flex-1 flex-col" : undefined}>
            <WordReviewCard
              word={wordQueue[0]}
              groupLabel={groupName(wordQueue[0].group_id)}
              currentIndex={wordSessionTotalRef.current - wordQueue.length}
              totalCount={Math.max(wordSessionTotalRef.current, wordQueue.length)}
              expanded={focusMode}
              wordOrderMode={wordOrderMode}
              onToggleWordOrder={() =>
                setWordOrderMode((mode) =>
                  mode === "shuffle" ? "created_at" : "shuffle"
                )
              }
              onReviewed={handleWordReview}
              onSkip={handleWordSkip}
              onDefer={handleWordDefer}
            />
            </div>
          )}
        </>
      ) : loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex max-h-[calc(100vh-14rem)] min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">普通卡片</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {completedStats.item_count}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {completedItems.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">今天还没有复习普通卡片</p>
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
      )}

      {curveItem && (
        <ForgettingCurveModal item={curveItem} onClose={() => setCurveItem(null)} />
      )}
    </div>
  );
}
