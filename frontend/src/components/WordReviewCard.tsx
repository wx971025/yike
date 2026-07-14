import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewWord } from "../types";
import { useGroups } from "../context/GroupContext";
import { useWordReviewUi } from "../context/WordReviewUiContext";
import {
  playBackspaceSound,
  playEnterSound,
  playSpaceConfirmSound,
  playTypewriterSound,
  warmUpKeyboardSounds,
} from "../utils/wordReviewSounds";
import { CardKindBadge } from "./CardKindBadge";

type WordOrderMode = "shuffle" | "created_at";

interface WordReviewCardProps {
  word: ReviewWord;
  groupLabel: string;
  currentIndex: number;
  totalCount: number;
  expanded?: boolean;
  wordOrderMode?: WordOrderMode;
  onToggleWordOrder?: () => void;
  onReviewed: (id: number) => void;
  onSkip: (id: number) => void;
  onDefer: (id: number) => void;
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
    <div className="flex w-full justify-center px-4">
      <div className="inline-grid max-w-full [&>*]:col-start-1 [&>*]:row-start-1">
        <span
          aria-hidden
          className="invisible whitespace-pre px-1 text-2xl font-medium tracking-wide"
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
          className={`w-full min-w-0 border-0 border-b-2 bg-transparent px-1 py-2 text-center text-2xl font-medium tracking-wide outline-none transition-colors placeholder:text-base placeholder:font-normal placeholder:text-slate-300 ${
            hasError
              ? "border-red-400 text-red-600 focus:border-red-500"
              : "border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400"
          }`}
        />
      </div>
    </div>
  );
}

function FocusToolbar({
  wordOrderMode,
  onToggleWordOrder,
}: {
  wordOrderMode: WordOrderMode;
  onToggleWordOrder: () => void;
}) {
  const {
    keyboardSoundEnabled,
    setKeyboardSoundEnabled,
    setFocusMode,
  } = useWordReviewUi();

  return (
    <div className="mt-3 flex items-center justify-end gap-2 px-2 sm:px-4">
      <button
        type="button"
        onClick={onToggleWordOrder}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
          wordOrderMode === "shuffle"
            ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
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
      >
        <span aria-hidden>{keyboardSoundEnabled ? "🔊" : "🔇"}</span>
        {keyboardSoundEnabled ? "键盘音" : "静音"}
      </button>
      <button
        type="button"
        onClick={() => setFocusMode(false)}
        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
      >
        <span aria-hidden>↙</span>
        退出放大
      </button>
    </div>
  );
}

function ShortcutHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function FocusShortcutHints() {
  return (
    <div className="shrink-0 px-4 pb-1 pt-0 -mt-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400 dark:text-slate-500">
        <ShortcutHint keys="Ctrl + ;" label="查看答案" />
        <ShortcutHint keys="Ctrl + K" label="开关键盘音" />
        <ShortcutHint keys="Ctrl + O" label="乱序顺序切换" />
      </div>
    </div>
  );
}

export default function WordReviewCard({
  word,
  groupLabel,
  currentIndex,
  totalCount,
  expanded = false,
  wordOrderMode = "shuffle",
  onToggleWordOrder,
  onReviewed,
  onSkip,
  onDefer,
}: WordReviewCardProps) {
  const { totalStagesForGroupId } = useGroups();
  const {
    keyboardSoundEnabled,
    setKeyboardSoundEnabled,
  } = useWordReviewUi();
  const totalStages = totalStagesForGroupId(word.group_id);
  const [input, setInput] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCardState = () => {
    setInput("");
    setWrongCount(0);
    setHasError(false);
    setIsCorrect(false);
    setRevealedAnswer(false);
  };

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
    fadeIn();
    return clearFadeTimer;
  }, [word.id]);

  const transitionToNext = (action: () => void) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setVisible(false);
    clearFadeTimer();
    fadeTimerRef.current = setTimeout(() => {
      action();
      fadeTimerRef.current = null;
    }, FADE_MS);
  };

  const playAdvanceSound = (key: string) => {
    if (key === " ") void playSpaceConfirmSound();
    else void playEnterSound();
  };

  const peeked = revealedAnswer || wrongCount >= 3;

  const advanceAfterCorrect = useCallback(
    (key: string) => {
      if (isTransitioning || !isCorrect) return;
      playAdvanceSound(key);
      if (peeked) {
        transitionToNext(() => onDefer(word.id));
      } else {
        transitionToNext(() => onReviewed(word.id));
      }
    },
    [isCorrect, isTransitioning, peeked, word.id, onDefer, onReviewed]
  );

  useEffect(() => {
    if (isCorrect) void warmUpKeyboardSounds();
  }, [isCorrect]);

  useEffect(() => {
    if (isTransitioning) return;
    if (isCorrect) {
      nextButtonRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [word.id, isCorrect, isTransitioning, visible]);

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
    if (!expanded) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;

      if (e.key === ";" || e.key === ":") {
        e.preventDefault();
        if (!isCorrect && !isTransitioning) setRevealedAnswer(true);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setKeyboardSoundEnabled(!keyboardSoundEnabled);
        return;
      }

      if (key === "o" && onToggleWordOrder) {
        e.preventDefault();
        onToggleWordOrder();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    expanded,
    isCorrect,
    isTransitioning,
    keyboardSoundEnabled,
    setKeyboardSoundEnabled,
    onToggleWordOrder,
  ]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCorrect || isTransitioning) return;

    if (isConfirmKey(e.key)) {
      if (e.key === " ") {
        e.preventDefault();
        if (!input.trim()) return;
        void playSpaceConfirmSound();
        formRef.current?.requestSubmit();
        return;
      }
      void playEnterSound();
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

    const answer = input.trim();
    if (!answer) return;

    if (answer.toLowerCase() === word.word.trim().toLowerCase()) {
      setIsCorrect(true);
      setHasError(false);
      return;
    }

    setHasError(true);
    if (!peeked) {
      setWrongCount((count) => count + 1);
    }
    setInput("");
    inputRef.current?.focus();
  };

  const goNext = () => {
    advanceAfterCorrect("Enter");
  };

  const handleNextButtonKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (!isConfirmKey(e.key) || e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    advanceAfterCorrect(e.key);
  };

  const handleSkip = () => {
    transitionToNext(() => onSkip(word.id));
  };

  const progressPercent =
    totalCount > 0 ? Math.min(100, ((currentIndex + 1) / totalCount) * 100) : 0;

  return (
    <div
      className={`flex w-full flex-col overflow-hidden rounded-2xl ${
        expanded ? "min-h-0 flex-1" : ""
      } ${
        word.overdue_days > 0
          ? "ring-1 ring-red-200/80 dark:ring-red-900/50"
          : ""
      }`}
    >
      <div className="shrink-0 px-2 pt-3 sm:px-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>复习进度</span>
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
          aria-label="单词复习进度"
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {expanded && onToggleWordOrder && (
          <FocusToolbar
            wordOrderMode={wordOrderMode}
            onToggleWordOrder={onToggleWordOrder}
          />
        )}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ease-in-out ${
          expanded ? "min-h-[24rem]" : "min-h-[18rem]"
        } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
      <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-3 sm:px-4">
        <div>
          <CardKindBadge kind="word" />
          <span className="ml-2 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
            {groupLabel}
          </span>
        </div>
        {word.phonetic && (
          <button
            type="button"
            onClick={() => setShowPhonetic((value) => !value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              showPhonetic
                ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {showPhonetic ? "隐藏音标" : "显示音标"}
          </button>
        )}
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col justify-start"
      >
        <div
          className={`flex flex-col items-center px-4 sm:px-6 ${
            expanded ? "pt-8 pb-6" : "pt-4 pb-6"
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
              第 {word.stage_index + 1}/{totalStages} 轮
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              应复习于 {word.due_date}
            </span>
            {word.overdue_days > 0 && (
              <span className="font-medium text-red-500">
                逾期 {word.overdue_days} 天
              </span>
            )}
          </div>

          <div className="mb-8 max-w-3xl text-center">
            <p className="text-2xl font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
              {word.meaning}
            </p>
            {word.phonetic && showPhonetic && (
              <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
                {word.phonetic}
              </p>
            )}
          </div>

          {(wrongCount >= 3 || revealedAnswer) && !isCorrect && (
            <p className="mb-6 rounded-lg bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {word.word}
              {word.phonetic && (
                <span className="ml-2 font-normal text-amber-700 dark:text-amber-300">
                  {word.phonetic}
                </span>
              )}
            </p>
          )}

          {isCorrect ? (
            <div className="text-center">
              <p className="mb-2 text-sm font-medium text-green-700">回答正确</p>
              <p className="text-3xl font-semibold text-green-800">{word.word}</p>
              {word.phonetic && (
                <p className="mt-2 text-base text-green-700">{word.phonetic}</p>
              )}
            </div>
          ) : (
            <div className="w-full max-w-2xl">
              <UnderlineInput
                value={input}
                onChange={(value) => {
                  setInput(value);
                  if (hasError) setHasError(false);
                }}
                onKeyDown={handleInputKeyDown}
                hasError={hasError}
                inputRef={inputRef}
                placeholder={
                  peeked
                    ? "对照答案输入单词，回车或空格确认"
                    : "根据释义输入单词，回车或空格确认"
                }
              />
              {hasError && (
                <p className="mt-4 text-center text-sm text-red-600">
                  拼写不正确，请再试一次
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-center gap-3">
            {isCorrect ? (
              <button
                ref={nextButtonRef}
                type="button"
                onClick={goNext}
                onKeyDown={handleNextButtonKeyDown}
                disabled={isTransitioning}
                className="min-w-[8rem] rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                下一个
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || isTransitioning}
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

      {expanded && <FocusShortcutHints />}
    </div>
  );
}
