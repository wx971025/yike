import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi, confusablePairApi } from "../api";
import type { ReviewConfusablePair } from "../types";
import { useGroups } from "../context/GroupContext";
import {
  playWordPronunciation,
  stopWordPronunciation,
} from "../utils/wordPronunciation";
import {
  playBackspaceSound,
  playEnterSound,
  playSpaceConfirmSound,
  playTypewriterSound,
  warmUpKeyboardSounds,
} from "../utils/wordReviewSounds";
import { CardKindBadge } from "./CardKindBadge";
import ReviewExampleSentence from "./ReviewExampleSentence";
import { SparkleIcon } from "./ItemIcons";
import { splitSentenceForCloze } from "../utils/wordExampleCloze";

interface ConfusablePairReviewCardProps {
  pair: ReviewConfusablePair;
  currentIndex: number;
  totalCount: number;
  onReviewed: (id: number) => void;
  onSkip: (id: number) => void;
  onDefer: (id: number) => void;
  onPeekAnswer: (id: number) => void;
  onPairUpdated?: (pair: ReviewConfusablePair) => void;
}

const MIN_LINE_CHARS = 6;
const FADE_MS = 280;

function isConfirmKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

interface UnderlineInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  hasError: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}

function UnderlineInput({
  value,
  onChange,
  onKeyDown,
  hasError,
  inputRef,
  placeholder = "输入单词",
}: UnderlineInputProps) {
  const mirrorText =
    value.length > 0 ? value : "\u00A0".repeat(MIN_LINE_CHARS);

  return (
    <div className="flex w-full justify-center px-2">
      <div className="inline-grid max-w-full [&>*]:col-start-1 [&>*]:row-start-1">
        <span
          aria-hidden
          className="invisible whitespace-pre px-1 text-xl font-medium tracking-wide"
        >
          {mirrorText}
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`w-full min-w-0 border-0 border-b-2 bg-transparent px-1 py-2 text-center text-xl font-medium tracking-wide outline-none transition-colors placeholder:text-sm placeholder:font-normal placeholder:text-slate-300 ${
            hasError
              ? "border-red-400 text-red-600 focus:border-red-500"
              : "border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:border-rose-500 dark:focus:border-rose-400"
          }`}
        />
      </div>
    </div>
  );
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
  meaning,
  phonetic,
  targetWord,
  exampleEn,
  exampleZh,
  exampleConfirmed,
  input,
  hasError,
  revealed,
  peeked,
  isCorrect,
  generatingExample,
  generateExampleError,
  inputRef,
  onChange,
  onKeyDown,
  onGenerateExample,
  actionsDisabled,
}: {
  meaning: string;
  phonetic: string;
  targetWord: string;
  exampleEn: string;
  exampleZh: string;
  exampleConfirmed: boolean;
  input: string;
  hasError: boolean;
  revealed: boolean;
  peeked: boolean;
  isCorrect: boolean;
  generatingExample: boolean;
  generateExampleError: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onGenerateExample: () => void;
  actionsDisabled: boolean;
}) {
  const hasExample = Boolean(exampleEn.trim() || exampleZh.trim());
  const exampleCloze = exampleEn.trim()
    ? splitSentenceForCloze(exampleEn, targetWord)
    : null;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white/60 p-4 pt-8 dark:border-slate-700 dark:bg-slate-900/40">
      {!hasExample && (
        <GenerateExampleButton
          onClick={onGenerateExample}
          disabled={actionsDisabled}
          generating={generatingExample}
        />
      )}

      <p className="mb-4 text-center text-lg font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
        {meaning}
      </p>

      {hasExample && (
        exampleCloze ? (
          <ReviewExampleSentence
            example={{ en: exampleEn, zh: exampleZh }}
            word={targetWord}
            showFull={exampleConfirmed || isCorrect}
            className="mb-4 text-center"
          />
        ) : (
          <div className="mb-4 text-center">
            {exampleEn.trim() && (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {exampleEn}
              </p>
            )}
            {exampleZh.trim() && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {exampleZh}
              </p>
            )}
          </div>
        )
      )}

      {!hasExample && generateExampleError && (
        <p className="mb-3 text-center text-xs text-red-500">{generateExampleError}</p>
      )}

      {revealed && !isCorrect && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {targetWord}
          {phonetic && (
            <span className="ml-2 font-normal text-amber-700 dark:text-amber-300">
              {phonetic}
            </span>
          )}
        </p>
      )}

      {isCorrect ? (
        <div className="text-center">
          <p className="mb-1 text-sm font-medium text-green-700">正确</p>
          <p className="text-2xl font-semibold text-green-800">{targetWord}</p>
          {phonetic && (
            <p className="mt-1 text-sm text-green-700">{phonetic}</p>
          )}
        </div>
      ) : (
        <div>
          <UnderlineInput
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            hasError={hasError}
            inputRef={inputRef}
            placeholder={
              peeked
                ? "对照答案输入，回车确认"
                : "根据释义输入单词"
            }
          />
          {hasError && (
            <p className="mt-3 text-center text-xs text-red-600">拼写不正确</p>
          )}
        </div>
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
  onDefer,
  onPeekAnswer,
  onPairUpdated,
}: ConfusablePairReviewCardProps) {
  const { totalStagesForGroupId } = useGroups();
  const totalStages = totalStagesForGroupId(null);

  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
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
  const [confirmedA, setConfirmedA] = useState(false);
  const [confirmedB, setConfirmedB] = useState(false);

  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekResetDoneRef = useRef(false);

  const resetCardState = () => {
    setInputA("");
    setInputB("");
    setErrorA(false);
    setErrorB(false);
    setWrongCount(0);
    setIsCorrect(false);
    setRevealedAnswer(false);
    setExampleA({ en: pair.example_a, zh: pair.example_a_translation });
    setExampleB({ en: pair.example_b, zh: pair.example_b_translation });
    setGenerateExampleErrorA("");
    setGenerateExampleErrorB("");
    setConfirmedA(false);
    setConfirmedB(false);
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
    peekResetDoneRef.current = false;
    setVisible(false);
    stopWordPronunciation();
    fadeIn();
    return clearFadeTimer;
  }, [pair.id]);

  const peeked = revealedAnswer || wrongCount >= 3;

  useEffect(() => {
    if (!peeked || peekResetDoneRef.current || isTransitioning) return;
    peekResetDoneRef.current = true;
    onPeekAnswer(pair.id);
  }, [peeked, pair.id, onPeekAnswer, isTransitioning]);

  const transitionToNext = (action: () => void) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setVisible(false);
    clearFadeTimer();
    fadeTimerRef.current = setTimeout(() => {
      action();
      resetCardState();
      peekResetDoneRef.current = false;
      stopWordPronunciation();
      fadeIn();
      fadeTimerRef.current = null;
    }, FADE_MS);
  };

  const advanceAfterCorrect = useCallback(
    (_key: string) => {
      if (isTransitioning || !isCorrect) return;
      stopWordPronunciation();
      if (peeked) {
        transitionToNext(() => onDefer(pair.id));
      } else {
        transitionToNext(() => onReviewed(pair.id));
      }
    },
    [isCorrect, isTransitioning, peeked, pair.id, onDefer, onReviewed]
  );

  useEffect(() => {
    if (isCorrect) void warmUpKeyboardSounds();
  }, [isCorrect]);

  useEffect(() => {
    if (isTransitioning) return;
    if (isCorrect) {
      nextButtonRef.current?.focus();
    } else {
      inputARef.current?.focus();
    }
  }, [pair.id, isCorrect, isTransitioning, visible]);

  useEffect(() => {
    if (!isCorrect || isTransitioning) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isConfirmKey(e.key) || e.repeat) return;
      e.preventDefault();
      advanceAfterCorrect(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCorrect, isTransitioning, advanceAfterCorrect]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      if (e.key === ";" || e.key === ":") {
        e.preventDefault();
        if (!isCorrect && !isTransitioning) setRevealedAnswer(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCorrect, isTransitioning]);

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    side: "a" | "b"
  ) => {
    if (isCorrect || isTransitioning) return;

    if (isConfirmKey(e.key)) {
      if (e.key === " ") {
        e.preventDefault();
        const current = side === "a" ? inputA : inputB;
        if (!current.trim()) return;
        void playSpaceConfirmSound();
        formRef.current?.requestSubmit();
        return;
      }
      e.preventDefault();
      void playEnterSound();
      if (side === "a") {
        inputBRef.current?.focus();
        return;
      }
      formRef.current?.requestSubmit();
      return;
    }

    if (e.key === "Backspace") {
      if (!e.repeat) void playBackspaceSound();
      return;
    }

    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.nativeEvent.isComposing
    ) {
      void playTypewriterSound();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCorrect) return;

    const answerA = inputA.trim();
    const answerB = inputB.trim();
    if (!answerA || !answerB) return;

    const okA = answerA.toLowerCase() === pair.word_a.trim().toLowerCase();
    const okB = answerB.toLowerCase() === pair.word_b.trim().toLowerCase();

    if (okA && okB) {
      setIsCorrect(true);
      setErrorA(false);
      setErrorB(false);
      setConfirmedA(true);
      setConfirmedB(true);
      return;
    }

    if (okA) setConfirmedA(true);
    if (okB) setConfirmedB(true);
    setErrorA(!okA);
    setErrorB(!okB);
    if (!peeked) {
      setWrongCount((count) => count + 1);
    }
    if (!okA) setInputA("");
    if (!okB) setInputB("");
    if (!okA) inputARef.current?.focus();
    else inputBRef.current?.focus();
  };

  const handleSkip = () => {
    stopWordPronunciation();
    transitionToNext(() => onSkip(pair.id));
  };

  const progressPercent =
    totalCount > 0 ? Math.min(100, ((currentIndex + 1) / totalCount) * 100) : 0;

  return (
    <div
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
            <span className="ml-2 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
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
              className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              读 {pair.word_b}
            </button>
          </div>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col justify-start"
        >
          <div className="flex flex-col px-4 pb-4 pt-2 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700">
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

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <SidePanel
                meaning={pair.meaning_a}
                phonetic={pair.phonetic_a}
                targetWord={pair.word_a}
                exampleEn={exampleA.en}
                exampleZh={exampleA.zh}
                exampleConfirmed={confirmedA}
                input={inputA}
                hasError={errorA}
                revealed={wrongCount >= 3 || revealedAnswer}
                peeked={peeked}
                isCorrect={isCorrect}
                generatingExample={generatingExampleA}
                generateExampleError={generateExampleErrorA}
                inputRef={inputARef}
                onChange={(value) => {
                  setInputA(value);
                  if (errorA) setErrorA(false);
                  if (confirmedA) setConfirmedA(false);
                }}
                onKeyDown={(e) => handleInputKeyDown(e, "a")}
                onGenerateExample={() => void handleGenerateExample("a")}
                actionsDisabled={isTransitioning}
              />
              <div className="flex shrink-0 items-center justify-center text-2xl text-rose-300 dark:text-rose-800">
                ↔
              </div>
              <SidePanel
                meaning={pair.meaning_b}
                phonetic={pair.phonetic_b}
                targetWord={pair.word_b}
                exampleEn={exampleB.en}
                exampleZh={exampleB.zh}
                exampleConfirmed={confirmedB}
                input={inputB}
                hasError={errorB}
                revealed={wrongCount >= 3 || revealedAnswer}
                peeked={peeked}
                isCorrect={isCorrect}
                generatingExample={generatingExampleB}
                generateExampleError={generateExampleErrorB}
                inputRef={inputBRef}
                onChange={(value) => {
                  setInputB(value);
                  if (errorB) setErrorB(false);
                  if (confirmedB) setConfirmedB(false);
                }}
                onKeyDown={(e) => handleInputKeyDown(e, "b")}
                onGenerateExample={() => void handleGenerateExample("b")}
                actionsDisabled={isTransitioning}
              />
            </div>

            <div className="flex justify-center gap-3">
              {isCorrect ? (
                <button
                  ref={nextButtonRef}
                  type="button"
                  onClick={() => advanceAfterCorrect("Enter")}
                  disabled={isTransitioning}
                  className="min-w-[8rem] rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  下一个
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputA.trim() || !inputB.trim() || isTransitioning}
                  onClick={() => void playEnterSound()}
                  className="min-w-[8rem] rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  确认
                </button>
              )}
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
        </form>
      </div>

      <div className="mt-auto shrink-0 px-4 pb-2 pt-1 text-center text-xs text-slate-400 dark:text-slate-500">
        两侧都拼写正确才算完成 · Ctrl + ; 查看答案
      </div>
    </div>
  );
}
