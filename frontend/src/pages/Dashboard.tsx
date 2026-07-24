import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi, itemApi, wordApi, confusablePairApi } from "../api";
import { CardKindBadge } from "../components/CardKindBadge";
import ConfusablePairReviewCard from "../components/ConfusablePairReviewCard";
import ForgettingCurveModal from "../components/ForgettingCurveModal";
import GroupTag from "../components/GroupTag";
import PageGroupFilter from "../components/PageGroupFilter";
import WordReviewCard from "../components/WordReviewCard";
import WordReviewSettingsMenu from "../components/WordReviewSettingsMenu";
import { CurveIcon, ChevronLeftIcon, IconButton } from "../components/ItemIcons";
import { useAuth } from "../context/AuthContext";
import { useGroups } from "../context/GroupContext";
import { type Item, type ReviewConfusablePair, type ReviewItem, type ReviewWord, type ReviewedTodayItem } from "../types";
import { type WordReviewTrack, wordTrackLabel, wordTrackState } from "../utils/wordReviewTrack";
import {
  buildWordOrderSeedKey,
  groupFilterSeedKey,
  loadWordOrderMode,
  orderReviewWords,
  saveWordOrderMode,
  type WordOrderMode,
} from "../utils/wordReviewOrder";
import {
  resolveWordOrderMode,
  scheduleReviewSettingsSync,
} from "../utils/reviewSettingsSync";
import { sortByCreatedAt } from "../utils/sort";
import { todayStr, getNextReviewDate } from "../utils/reviewSchedule";

function mergeWordReviewQueue(
  prev: ReviewWord[],
  words: ReviewWord[],
  mode: WordOrderMode,
  orderSeedKey: string,
  sessionDoneIds: ReadonlySet<number>,
  resetSession: (ordered: ReviewWord[], batchTotal?: number | null) => void,
  bumpSessionTotal: (total: number) => void,
  batchTotal: number | null,
  shuffleSeed: number | null
): ReviewWord[] {
  const available = new Map(words.map((w) => [w.id, w]));
  const kept = prev
    .filter((w) => available.has(w.id))
    .map((w) => available.get(w.id)!);
  if (kept.length === 0) {
    if (words.length === 0) {
      return prev;
    }
    if (prev.length > 0) {
      return prev.map((w) => available.get(w.id) ?? w);
    }
    const ordered = orderReviewWords(
      words.filter((w) => !sessionDoneIds.has(w.id)),
      mode,
      orderSeedKey,
      shuffleSeed
    );
    resetSession(ordered, batchTotal);
    return ordered;
  }
  const keptIds = new Set(kept.map((w) => w.id));
  const additions = orderReviewWords(
    words.filter((w) => !keptIds.has(w.id) && !sessionDoneIds.has(w.id)),
    mode,
    orderSeedKey,
    shuffleSeed
  );
  if (additions.length === 0) {
    return kept;
  }
  const merged = [...kept, ...additions];
  bumpSessionTotal(merged.length);
  return merged;
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

function DueEmptyState({ kind }: { kind: "item" | "word" | "confusable" }) {
  const isItem = kind === "item";
  const isConfusable = kind === "confusable";
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 via-white to-amber-50/40 px-6 py-20 text-center dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/30">
      <div className="text-5xl leading-none">
        {isConfusable ? "🔀" : isItem ? "☁️" : "🌙"}
      </div>
      <p className="mt-4 text-base font-medium text-slate-600 dark:text-slate-300">
        {isConfusable
          ? "今天没有待复习的易混词对"
          : isItem
            ? "今天没有待复习的记忆卡片"
            : "今天没有待复习的单词卡片"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400 dark:text-slate-500">
        {isConfusable
          ? "易混词也都对齐啦，今天就让自己慢慢晃悠吧～"
          : isItem
            ? "慵懒一下也没关系，脑子也需要放空的时刻～"
            : "单词也都歇着啦，今天就让自己慢慢晃悠吧～"}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
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
  const [spellWords, setSpellWords] = useState<ReviewWord[]>([]);
  const [recognizeWords, setRecognizeWords] = useState<ReviewWord[]>([]);
  const [completed, setCompleted] = useState<ReviewedTodayItem[]>([]);
  const [completedStats, setCompletedStats] = useState({ total: 0, item_count: 0, word_count: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"due" | "stats">("due");
  const [dueSubTab, setDueSubTab] = useState<"item" | "word" | "confusable">("item");
  const [wordTrackTab, setWordTrackTab] = useState<WordReviewTrack>("spell");
  const [wordOrderMode, setWordOrderMode] = useState<WordOrderMode>(() =>
    loadWordOrderMode()
  );
  const [spellQueue, setSpellQueue] = useState<ReviewWord[]>([]);
  const [recognizeQueue, setRecognizeQueue] = useState<ReviewWord[]>([]);
  const [wordHistory, setWordHistory] = useState<ReviewWord[]>([]);
  const [confusablePairs, setConfusablePairs] = useState<ReviewConfusablePair[]>([]);
  const [confusableQueue, setConfusableQueue] = useState<ReviewConfusablePair[]>([]);
  const [curveItem, setCurveItem] = useState<Item | null>(null);
  const [reviewToast, setReviewToast] = useState<string | null>(null);
  const spellSessionTotalRef = useRef(0);
  const recognizeSessionTotalRef = useRef(0);
  const confusableSessionTotalRef = useRef(0);
  const spellSessionDoneIdsRef = useRef(new Set<number>());
  const recognizeSessionDoneIdsRef = useRef(new Set<number>());
  const spellBatchTotalRef = useRef<number | null>(null);
  const recognizeBatchTotalRef = useRef<number | null>(null);
  const spellShuffleSeedRef = useRef<number | null>(null);
  const recognizeShuffleSeedRef = useRef<number | null>(null);

  const dueWordGroupFilterKey = groupFilterSeedKey(dueWordGroupFilterIds);
  const spellOrderSeedKey = buildWordOrderSeedKey({
    userId: user?.id,
    track: "spell",
    groupFilterKey: dueWordGroupFilterKey,
  });
  const recognizeOrderSeedKey = buildWordOrderSeedKey({
    userId: user?.id,
    track: "recognize",
    groupFilterKey: dueWordGroupFilterKey,
  });

  const loadDueItems = useCallback(async () => {
    const res = await reviewApi.today(dueItemGroupFilterIds);
    setItems(res.data);
  }, [dueItemGroupFilterIds]);

  const loadDueWords = useCallback(async () => {
    const [spellRes, recognizeRes] = await Promise.all([
      reviewApi.todayWords(dueWordGroupFilterIds, "spell"),
      reviewApi.todayWords(dueWordGroupFilterIds, "recognize"),
    ]);
    setSpellWords(spellRes.data.words);
    setRecognizeWords(recognizeRes.data.words);
    spellBatchTotalRef.current = spellRes.data.batch_total;
    recognizeBatchTotalRef.current = recognizeRes.data.batch_total;
    spellShuffleSeedRef.current = spellRes.data.shuffle_seed;
    recognizeShuffleSeedRef.current = recognizeRes.data.shuffle_seed;
    spellSessionDoneIdsRef.current = new Set(
      spellRes.data.completed_word_ids ?? []
    );
    recognizeSessionDoneIdsRef.current = new Set(
      recognizeRes.data.completed_word_ids ?? []
    );
  }, [dueWordGroupFilterIds]);

  const markWordSessionProgress = useCallback(
    (wordId: number, track: WordReviewTrack) => {
      void reviewApi
        .markWordSessionProgress(wordId, dueWordGroupFilterIds, track)
        .catch(() => {});
    },
    [dueWordGroupFilterIds]
  );

  useEffect(() => {
    if (!user) return;
    setWordOrderMode(resolveWordOrderMode(user));
  }, [user?.word_review_order_mode]);

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
        loadCompleted(),
      ]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [loadDueItems, loadDueWords, loadDueConfusablePairs, loadCompleted]);

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

  const resetSpellSession = useCallback(
    (ordered: ReviewWord[], batchTotal?: number | null) => {
      setSpellQueue(ordered);
      setWordHistory([]);
      spellSessionTotalRef.current = batchTotal ?? ordered.length;
    },
    []
  );

  const resetRecognizeSession = useCallback(
    (ordered: ReviewWord[], batchTotal?: number | null) => {
      setRecognizeQueue(ordered);
      setWordHistory([]);
      recognizeSessionTotalRef.current = batchTotal ?? ordered.length;
    },
    []
  );

  useEffect(() => {
    spellSessionTotalRef.current = 0;
    recognizeSessionTotalRef.current = 0;
    spellSessionDoneIdsRef.current.clear();
    recognizeSessionDoneIdsRef.current.clear();
    spellBatchTotalRef.current = null;
    recognizeBatchTotalRef.current = null;
    resetSpellSession([]);
    resetRecognizeSession([]);
  }, [dueWordGroupFilterIds, resetSpellSession, resetRecognizeSession]);

  useEffect(() => {
    confusableSessionTotalRef.current = 0;
    setConfusableQueue([]);
  }, []);

  useEffect(() => {
    spellSessionTotalRef.current = Math.max(
      spellSessionTotalRef.current,
      spellWords.length
    );
  }, [spellWords.length]);

  useEffect(() => {
    recognizeSessionTotalRef.current = Math.max(
      recognizeSessionTotalRef.current,
      recognizeWords.length
    );
  }, [recognizeWords.length]);

  useEffect(() => {
    confusableSessionTotalRef.current = Math.max(
      confusableSessionTotalRef.current,
      confusablePairs.length
    );
  }, [confusablePairs.length]);

  useEffect(() => {
    setSpellQueue((prev) =>
      mergeWordReviewQueue(
        prev,
        spellWords,
        wordOrderMode,
        spellOrderSeedKey,
        spellSessionDoneIdsRef.current,
        resetSpellSession,
        (total) => {
          spellSessionTotalRef.current = Math.max(
            spellSessionTotalRef.current,
            total
          );
        },
        spellBatchTotalRef.current,
        spellShuffleSeedRef.current
      )
    );
  }, [spellWords, resetSpellSession, wordOrderMode, spellOrderSeedKey]);

  useEffect(() => {
    setRecognizeQueue((prev) =>
      mergeWordReviewQueue(
        prev,
        recognizeWords,
        wordOrderMode,
        recognizeOrderSeedKey,
        recognizeSessionDoneIdsRef.current,
        resetRecognizeSession,
        (total) => {
          recognizeSessionTotalRef.current = Math.max(
            recognizeSessionTotalRef.current,
            total
          );
        },
        recognizeBatchTotalRef.current,
        recognizeShuffleSeedRef.current
      )
    );
  }, [recognizeWords, resetRecognizeSession, wordOrderMode, recognizeOrderSeedKey]);

  useEffect(() => {
    spellSessionDoneIdsRef.current.clear();
    resetSpellSession(
      orderReviewWords(
        spellWords,
        wordOrderMode,
        spellOrderSeedKey,
        spellShuffleSeedRef.current
      ),
      spellBatchTotalRef.current
    );
  }, [wordOrderMode]);

  useEffect(() => {
    recognizeSessionDoneIdsRef.current.clear();
    resetRecognizeSession(
      orderReviewWords(
        recognizeWords,
        wordOrderMode,
        recognizeOrderSeedKey,
        recognizeShuffleSeedRef.current
      ),
      recognizeBatchTotalRef.current
    );
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
    setWordHistory([]);
  }, [wordTrackTab]);

  useEffect(() => {
    if (!reviewToast) return;
    const timer = window.setTimeout(() => setReviewToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [reviewToast]);

  const itemCount = items.length;
  const spellCount = spellQueue.length;
  const recognizeCount = recognizeQueue.length;
  const wordCount = spellCount + recognizeCount;
  const activeWordQueue = wordTrackTab === "spell" ? spellQueue : recognizeQueue;
  const activeSessionTotal =
    wordTrackTab === "spell"
      ? spellSessionTotalRef.current
      : recognizeSessionTotalRef.current;
  const activeBatchTotal =
    wordTrackTab === "spell"
      ? spellBatchTotalRef.current
      : recognizeBatchTotalRef.current;
  const activeCompletedCount =
    wordTrackTab === "spell"
      ? spellSessionDoneIdsRef.current.size
      : recognizeSessionDoneIdsRef.current.size;
  const wordProgressTotal =
    activeBatchTotal ??
    Math.max(
      activeSessionTotal,
      activeCompletedCount,
      wordHistory.length + activeWordQueue.length
    );
  const wordProgressStep =
    activeBatchTotal != null
      ? Math.max(
          0,
          activeBatchTotal -
            activeWordQueue.length +
            (activeWordQueue.length > 0 ? 1 : 0)
        )
      : activeCompletedCount + (activeWordQueue.length > 0 ? 1 : 0);
  const activeTrackReviewPending =
    wordTrackTab === "spell" ? spellCount > 0 : recognizeCount > 0;

  const openWordReviewTab = () => {
    setDueSubTab("word");
    if (spellCount > 0) {
      setWordTrackTab("spell");
    } else if (recognizeCount > 0) {
      setWordTrackTab("recognize");
    } else {
      setWordTrackTab("spell");
    }
  };

  const confusableCount = confusableQueue.length;
  const isWordReviewActive =
    activeTab === "due" &&
    dueSubTab === "word" &&
    activeTrackReviewPending;
  const isConfusableReviewActive =
    activeTab === "due" && dueSubTab === "confusable" && confusableCount > 0;
  const isSpellReviewActive = isWordReviewActive || isConfusableReviewActive;

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

  const setActiveWordQueue = (
    updater: (queue: ReviewWord[]) => ReviewWord[]
  ) => {
    if (wordTrackTab === "spell") {
      setSpellQueue(updater);
    } else {
      setRecognizeQueue(updater);
    }
  };

  const handleWordPrevious = () => {
    setWordHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setActiveWordQueue((queue) => {
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

  const removeWordFromTrack = (id: number, track: WordReviewTrack) => {
    if (track === "spell") {
      setSpellWords((prev) => prev.filter((w) => w.id !== id));
      setSpellQueue((prev) => prev.filter((w) => w.id !== id));
      return;
    }
    setRecognizeWords((prev) => prev.filter((w) => w.id !== id));
    setRecognizeQueue((prev) => prev.filter((w) => w.id !== id));
  };

  const handleWordSpellComplete = async (id: number, wasPeeked: boolean) => {
    const reviewed =
      spellQueue[0]?.id === id
        ? spellQueue[0]
        : spellWords.find((w) => w.id === id);
    if (!reviewed) return;

    if (wasPeeked) {
      pushWordHistory(reviewed);
      setSpellQueue((queue) => {
        const rest = queue.filter((w) => w.id !== id);
        return [...rest, reviewed];
      });
      setReviewToast(`${reviewed.word} 已排到队尾，稍后再练`);
      return;
    }

    setSpellQueue((queue) =>
      queue[0]?.id === id ? queue.slice(1) : queue
    );
    pushWordHistory(reviewed);
    setSpellWords((prev) => prev.filter((w) => w.id !== id));
    spellSessionDoneIdsRef.current.add(id);
    markWordSessionProgress(id, "spell");
    await wordApi.review(id, "spell");
    setReviewToast(`${reviewed.word} 拼写已复习`);
    void loadCompleted();
  };

  const handleWordRecognizeKnown = async (id: number) => {
    const reviewed =
      recognizeQueue[0]?.id === id
        ? recognizeQueue[0]
        : recognizeWords.find((w) => w.id === id);
    if (!reviewed) return;

    setRecognizeQueue((queue) =>
      queue[0]?.id === id ? queue.slice(1) : queue
    );
    pushWordHistory(reviewed);
    setRecognizeWords((prev) => prev.filter((w) => w.id !== id));
    recognizeSessionDoneIdsRef.current.add(id);
    markWordSessionProgress(id, "recognize");
    await wordApi.review(id, "recognize");
    setReviewToast(`${reviewed.word} 认知已复习`);
    void loadCompleted();
  };

  const handleWordRecognizeForgot = (id: number) => {
    const current = recognizeQueue[0];
    if (!current || current.id !== id) return;
    pushWordHistory(current);
    setRecognizeQueue((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      if (first.id !== id) return prev;
      return [...rest, first];
    });
  };

  const handleWordSkip = async (id: number) => {
    const current = activeWordQueue[0];
    if (current?.id === id) pushWordHistory(current);
    await wordApi.skip(id, wordTrackTab);
    if (wordTrackTab === "spell") {
      spellSessionDoneIdsRef.current.add(id);
    } else {
      recognizeSessionDoneIdsRef.current.add(id);
    }
    markWordSessionProgress(id, wordTrackTab);
    removeWordFromTrack(id, wordTrackTab);
    void loadCompleted();
  };

  const handleWordUpdated = useCallback((updated: ReviewWord) => {
    const patch = (word: ReviewWord): ReviewWord =>
      word.id === updated.id ? updated : word;
    setSpellWords((prev) => prev.map(patch));
    setRecognizeWords((prev) => prev.map(patch));
    setSpellQueue((prev) => prev.map(patch));
    setRecognizeQueue((prev) => prev.map(patch));
  }, []);

  const handleWordPeekReset = useCallback(
    async (id: number) => {
      try {
        const res = await wordApi.resetStage(id, "spell");
        const updated = res.data;
        const today = todayStr();
        const trackState = wordTrackState(updated, "spell");
        const dueDate =
          getNextReviewDate(
            trackState,
            memoryModeForGroupId(updated.group_id)
          ) ?? today;
        const patchWord = (word: ReviewWord): ReviewWord =>
          word.id === id
            ? {
                ...word,
                ...updated,
                due_date: dueDate,
                overdue_days: 0,
              }
            : word;
        setSpellWords((prev) => prev.map(patchWord));
        setSpellQueue((prev) => prev.map(patchWord));
      } catch {
        // 重置失败不阻断当前复习流程
      }
    },
    [memoryModeForGroupId]
  );

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
      key={`${entry.kind}-${entry.track ?? ""}-${entry.id}`}
      className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/50 px-4 py-3"
    >
      <span className="text-green-600">✓</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <CardKindBadge kind={entry.kind} />
          {entry.kind === "word" && entry.track && (
            <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
              {wordTrackLabel(entry.track)}
            </span>
          )}
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
              onClick={openWordReviewTab}
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
                    setWordOrderMode((mode) => {
                      const next = mode === "shuffle" ? "created_at" : "shuffle";
                      saveWordOrderMode(next);
                      scheduleReviewSettingsSync({ word_review_order_mode: next });
                      return next;
                    })
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
            <div className={isWordReviewActive ? "flex min-h-0 flex-1 flex-col" : undefined}>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWordTrackTab("spell")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  wordTrackTab === "spell"
                    ? "bg-violet-100 text-violet-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                拼写复习
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs dark:bg-slate-900/80">
                  {spellCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWordTrackTab("recognize")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  wordTrackTab === "recognize"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                认知复习
                <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs dark:bg-slate-900/80">
                  {recognizeCount}
                </span>
              </button>
            </div>
            {!activeTrackReviewPending ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                今天没有待{wordTrackLabel(wordTrackTab)}复习的单词
              </div>
            ) : (
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
              word={activeWordQueue[0]}
              groupId={activeWordQueue[0].group_id}
              track={wordTrackTab}
              mode={wordTrackTab}
              progressStep={wordProgressStep}
              progressTotal={wordProgressTotal}
              wordOrderMode={wordOrderMode}
              onToggleWordOrder={() =>
                setWordOrderMode((mode) => {
                  const next = mode === "shuffle" ? "created_at" : "shuffle";
                  saveWordOrderMode(next);
                  scheduleReviewSettingsSync({ word_review_order_mode: next });
                  return next;
                })
              }
              onSpellComplete={(id, wasPeeked) => void handleWordSpellComplete(id, wasPeeked)}
              onRecognizeKnown={(id) => void handleWordRecognizeKnown(id)}
              onRecognizeForgot={handleWordRecognizeForgot}
              onSkip={(id) => void handleWordSkip(id)}
              onPeekAnswer={handleWordPeekReset}
              onWordUpdated={handleWordUpdated}
            />
              </div>
            </div>
            )}
            </div>
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
        ) : null}
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
