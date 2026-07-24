import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi, confusablePairApi } from "../api";
import type { ConfusableDiffAnalysis, ReviewConfusablePair } from "../types";
import { useGroups } from "../context/GroupContext";
import {
  playWordPronunciation,
  stopWordPronunciation,
} from "../utils/wordPronunciation";
import { warmUpKeyboardSounds } from "../utils/wordReviewSounds";
import { shouldIgnoreGlobalShortcut } from "../utils/keyboardShortcuts";
import { CardKindBadge } from "./CardKindBadge";
import ConfusableDiffAnalysisPanel, {
  isValidDiffAnalysis,
} from "./ConfusableDiffAnalysisPanel";
import ReviewExampleSentence from "./ReviewExampleSentence";
import { SparkleIcon, DeleteIcon, IconButton } from "./ItemIcons";

interface ConfusablePairReviewCardProps {
  pair: ReviewConfusablePair;
  currentIndex: number;
  totalCount: number;
  onReviewed: (id: number) => void;
  onSkip: (id: number) => void;
  onDelete: (id: number) => void;
  onPairUpdated?: (pair: ReviewConfusablePair) => void;
}

const FADE_MS = 280;

function isConfirmKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

function GenerateExampleButton({
  onClick,
  disabled,
  generating,
}: {
  onClick: () => void;
  disabled?: boolean;
  generating?: boolean;
}) {
  return (
    <div className="group absolute right-2 top-2 z-10">
      <button
        type="button"
        title="生成例句"
        onClick={onClick}
        disabled={disabled || generating}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
      >
        {generating ? (
          <span className="text-xs font-medium">…</span>
        ) : (
          <SparkleIcon />
        )}
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-20 mt-1 scale-95 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] text-white opacity-0 shadow transition group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-700">
        生成例句
      </span>
    </div>
  );
}

function SidePanel({
  label,
  meaning,
  phonetic,
  targetWord,
  exampleEn,
  exampleZh,
  accentClass,
  generatingExample,
  generateExampleError,
  onGenerateExample,
  actionsDisabled,
}: {
  label: string;
  meaning: string;
  phonetic: string;
  targetWord: string;
  exampleEn: string;
  exampleZh: string;
  accentClass: string;
  generatingExample: boolean;
  generateExampleError: string;
  onGenerateExample: () => void;
  actionsDisabled: boolean;
}) {
  const hasExample = Boolean(exampleEn.trim() || exampleZh.trim());

  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col rounded-xl border p-4 pt-8 ${accentClass}`}
    >
      {!hasExample && (
        <GenerateExampleButton
          onClick={onGenerateExample}
          disabled={actionsDisabled}
          generating={generatingExample}
        />
      )}

      <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mb-4 text-center text-lg font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
        {meaning}
      </p>

      <div className="mb-4 text-center">
        <p className="text-3xl font-semibold tracking-wide text-slate-900 dark:text-slate-50">
          {targetWord}
        </p>
        {phonetic && (
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">{phonetic}</p>
        )}
      </div>

      {hasExample && (
        <ReviewExampleSentence
          example={{ en: exampleEn, zh: exampleZh }}
          word={targetWord}
          showFull
          className="text-center"
        />
      )}

      {!hasExample && generateExampleError && (
        <p className="mt-3 text-center text-xs text-red-500">{generateExampleError}</p>
      )}
    </div>
  );
}

export default function ConfusablePairReviewCard({
  pair,
  currentIndex,
  totalCount,
  onReviewed,
  onSkip,
  onDelete,
  onPairUpdated,
}: ConfusablePairReviewCardProps) {
  const { totalStagesForGroupId } = useGroups();
  const totalStages = totalStagesForGroupId(null);

  const [visible, setVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [exampleA, setExampleA] = useState({
    en: pair.example_a,
    zh: pair.example_a_translation,
  });
  const [exampleB, setExampleB] = useState({
    en: pair.example_b,
    zh: pair.example_b_translation,
  });
  const [generatingExampleA, setGeneratingExampleA] = useState(false);
  const [generatingExampleB, setGeneratingExampleB] = useState(false);
  const [generateExampleErrorA, setGenerateExampleErrorA] = useState("");
  const [generateExampleErrorB, setGenerateExampleErrorB] = useState("");
  const [diffAnalysis, setDiffAnalysis] = useState<ConfusableDiffAnalysis | null>(
    isValidDiffAnalysis(pair.diff_analysis) ? pair.diff_analysis : null
  );
  const [showDiffAnalysis, setShowDiffAnalysis] = useState(
    isValidDiffAnalysis(pair.diff_analysis)
  );
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");

  const completeButtonRef = useRef<HTMLButtonElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCardState = () => {
    setExampleA({ en: pair.example_a, zh: pair.example_a_translation });
    setExampleB({ en: pair.example_b, zh: pair.example_b_translation });
    setGenerateExampleErrorA("");
    setGenerateExampleErrorB("");
    setDiffAnalysis(isValidDiffAnalysis(pair.diff_analysis) ? pair.diff_analysis : null);
    setShowDiffAnalysis(isValidDiffAnalysis(pair.diff_analysis));
    setDiffError("");
  };

  const handleGenerateExample = useCallback(
    async (side: "a" | "b") => {
      const isSideA = side === "a";
      const currentExample = isSideA ? exampleA : exampleB;
      if (currentExample.en.trim() || currentExample.zh.trim()) {
        return;
      }

      const setGenerating = isSideA ? setGeneratingExampleA : setGeneratingExampleB;
      const setError = isSideA ? setGenerateExampleErrorA : setGenerateExampleErrorB;
      const word = isSideA ? pair.word_a : pair.word_b;
      const meaning = isSideA ? pair.meaning_a : pair.meaning_b;
      const pos = isSideA ? pair.pos_a : pair.pos_b;
      const phonetic = isSideA ? pair.phonetic_a : pair.phonetic_b;

      setGenerating(true);
      setError("");
      try {
        const res = await aiApi.generateWordExample({
          word,
          meaning,
          pos,
          phonetic,
          existing_examples: [],
        });
        const updated = await confusablePairApi.updateExample(pair.id, {
          side,
          example: res.data.en,
          example_translation: res.data.zh,
        });
        const nextExample = {
          en: updated.data.example_a,
          zh: updated.data.example_a_translation,
        };
        if (side === "b") {
          nextExample.en = updated.data.example_b;
          nextExample.zh = updated.data.example_b_translation;
        }
        if (isSideA) {
          setExampleA(nextExample);
        } else {
          setExampleB(nextExample);
        }
        onPairUpdated?.({
          ...pair,
          ...updated.data,
        });
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "生成例句失败";
        setError(typeof detail === "string" ? detail : "生成例句失败");
      } finally {
        setGenerating(false);
      }
    },
    [exampleA, exampleB, onPairUpdated, pair]
  );

  const handleDiffAnalysis = useCallback(async () => {
    if (isValidDiffAnalysis(diffAnalysis)) {
      setShowDiffAnalysis(true);
      return;
    }
    setDiffLoading(true);
    setDiffError("");
    try {
      const res = await confusablePairApi.diffAnalysis(pair.id);
      setDiffAnalysis(res.data.analysis);
      setShowDiffAnalysis(true);
      onPairUpdated?.({
        ...pair,
        diff_analysis: res.data.analysis,
      });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "AI 分析失败";
      setDiffError(typeof detail === "string" ? detail : "AI 分析失败");
    } finally {
      setDiffLoading(false);
    }
  }, [diffAnalysis, onPairUpdated, pair]);

  const clearFadeTimer = () => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const fadeIn = () => {
    clearFadeTimer();
    fadeTimerRef.current = setTimeout(() => {
      setVisible(true);
      setIsTransitioning(false);
      fadeTimerRef.current = null;
    }, 30);
  };

  useEffect(() => {
    resetCardState();
    setVisible(false);
    stopWordPronunciation();
    fadeIn();
    return clearFadeTimer;
  }, [pair.id]);

  const transitionToNext = (action: () => void) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setVisible(false);
    clearFadeTimer();
    fadeTimerRef.current = setTimeout(() => {
      action();
      resetCardState();
      stopWordPronunciation();
      fadeIn();
      fadeTimerRef.current = null;
    }, FADE_MS);
  };

  const handleComplete = useCallback(() => {
    if (isTransitioning) return;
    stopWordPronunciation();
    transitionToNext(() => onReviewed(pair.id));
  }, [isTransitioning, onReviewed, pair.id]);

  const handleSkip = () => {
    stopWordPronunciation();
    transitionToNext(() => onSkip(pair.id));
  };

  const handleDelete = () => {
    if (isTransitioning) return;
    if (
      !confirm(
        `确定删除易混词对「${pair.word_a} ↔ ${pair.word_b}」？删除后无法恢复。`
      )
    ) {
      return;
    }
    stopWordPronunciation();
    onDelete(pair.id);
  };

  useEffect(() => {
    void warmUpKeyboardSounds();
  }, [pair.id]);

  useEffect(() => {
    if (isTransitioning) return;
    completeButtonRef.current?.focus();
  }, [pair.id, isTransitioning, visible]);

  useEffect(() => {
    if (isTransitioning) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreGlobalShortcut(e)) return;
      if (!isConfirmKey(e.key) || e.repeat) return;
      e.preventDefault();
      handleComplete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTransitioning, handleComplete]);

  const progressPercent =
    totalCount > 0 ? Math.min(100, ((currentIndex + 1) / totalCount) * 100) : 0;

  return (
    <div
      data-review-shortcut-root
      className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl ${
        pair.overdue_days > 0
          ? "ring-1 ring-red-200/80 dark:ring-red-900/50"
          : ""
      }`}
    >
      <div className="shrink-0 px-2 pt-1 sm:px-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>易混词复习进度</span>
          <span className="tabular-nums">
            {currentIndex + 1} / {totalCount}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalCount}
          aria-label="易混词复习进度"
        >
          <div
            className="h-full rounded-full bg-rose-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ease-in-out ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-2 sm:px-4">
          <div>
            <CardKindBadge kind="confusable_pair" />
            <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              无分组 · 艾宾浩斯
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void playWordPronunciation(pair.word_a)}
              className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              读 {pair.word_a}
            </button>
            <button
              type="button"
              onClick={() => void playWordPronunciation(pair.word_b)}
              disabled={isTransitioning}
              className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              读 {pair.word_b}
            </button>
            <IconButton
              title="删除易混词对"
              onClick={handleDelete}
              disabled={isTransitioning}
              className="h-8 w-8 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <DeleteIcon />
            </IconButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-start">
          <div className="flex flex-col px-4 pb-4 pt-2 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                第 {pair.stage_index + 1}/{totalStages} 轮
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                应复习于 {pair.due_date}
              </span>
              {pair.overdue_days > 0 && (
                <span className="font-medium text-red-500">
                  逾期 {pair.overdue_days} 天
                </span>
              )}
            </div>

            <p className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400">
              对照两侧释义、拼写与例句，看清差异后点击「我已记住」
            </p>

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <SidePanel
                label="单词 A"
                meaning={pair.meaning_a}
                phonetic={pair.phonetic_a}
                targetWord={pair.word_a}
                exampleEn={exampleA.en}
                exampleZh={exampleA.zh}
                accentClass="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                generatingExample={generatingExampleA}
                generateExampleError={generateExampleErrorA}
                onGenerateExample={() => void handleGenerateExample("a")}
                actionsDisabled={isTransitioning}
              />
              <div className="flex shrink-0 items-center justify-center text-2xl text-rose-300 dark:text-rose-800">
                ↔
              </div>
              <SidePanel
                label="单词 B"
                meaning={pair.meaning_b}
                phonetic={pair.phonetic_b}
                targetWord={pair.word_b}
                exampleEn={exampleB.en}
                exampleZh={exampleB.zh}
                accentClass="border-violet-200 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20"
                generatingExample={generatingExampleB}
                generateExampleError={generateExampleErrorB}
                onGenerateExample={() => void handleGenerateExample("b")}
                actionsDisabled={isTransitioning}
              />
            </div>

            <div className="mb-4">
              {showDiffAnalysis && isValidDiffAnalysis(diffAnalysis) ? (
                <ConfusableDiffAnalysisPanel
                  analysis={diffAnalysis}
                  wordA={pair.word_a}
                  wordB={pair.word_b}
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDiffAnalysis()}
                    disabled={diffLoading || isTransitioning}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200 dark:hover:bg-indigo-950/50"
                  >
                    <SparkleIcon />
                    {diffLoading ? "AI 分析中..." : "AI 分析差异"}
                  </button>
                  {diffError && (
                    <p className="text-center text-xs text-red-500">{diffError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3">
              <button
                ref={completeButtonRef}
                type="button"
                onClick={handleComplete}
                disabled={isTransitioning}
                className="min-w-[8rem] rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                我已记住
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isTransitioning}
                className="rounded-lg border border-slate-200/80 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100/60 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/40"
              >
                跳过
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto shrink-0 px-4 pb-2 pt-1 text-center text-xs text-slate-400 dark:text-slate-500">
        回车或空格 · 我已记住
      </div>
    </div>
  );
}
