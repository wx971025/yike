import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiApi, confusablePairApi, wordApi } from "../api";
import type { ConfusablePairFromReviewPreview } from "../api";
import type { ReviewWord } from "../types";
import { useGroups } from "../context/GroupContext";
import { useWordReviewUi } from "../context/WordReviewUiContext";
import {
  playWordPronunciation,
  playWordPronunciationRepeated,
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
import ConfusablePairPromptModal from "./ConfusablePairPromptModal";
import ConfusablePairCreateModal from "./ConfusablePairCreateModal";
import { EditIcon, IconButton } from "./ItemIcons";
import WordEditModal from "./WordEditModal";
import ReviewExampleSentence from "./ReviewExampleSentence";
import {
  sanitizeWordExamples,
  wordExamplesFromWord,
} from "./WordExamplesEditor";
import { pickReviewExample } from "../utils/wordExampleCloze";
import { todayStr } from "../utils/reviewSchedule";

interface WordReviewCardProps {
  word: ReviewWord;
  groupLabel: string;
  currentIndex: number;
  totalCount: number;
  wordOrderMode?: "shuffle" | "created_at";
  onToggleWordOrder?: () => void;
  onReviewed: (id: number) => void;
  onSkip: (id: number) => void;
  onDefer: (id: number) => void;
  onPeekAnswer: (id: number) => void;
  onWordUpdated?: (word: ReviewWord) => void;
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

function ShortcutHints() {
  return (
    <div className="mt-auto shrink-0 px-4 pb-2 pt-1 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400 dark:text-slate-500">
        <ShortcutHint keys="Ctrl + ;" label="查看答案" />
        <ShortcutHint keys="Ctrl + P" label="播放读音" />
        <ShortcutHint keys="Ctrl + K" label="开关键盘音" />
        <ShortcutHint keys="Ctrl + O" label="乱序顺序切换" />
        <ShortcutHint keys="Ctrl + E" label="生成例句" />
      </div>
    </div>
  );
}

export default function WordReviewCard({
  word,
  groupLabel,
  currentIndex,
  totalCount,
  wordOrderMode = "shuffle",
  onToggleWordOrder,
  onReviewed,
  onSkip,
  onDefer,
  onPeekAnswer,
  onWordUpdated,
}: WordReviewCardProps) {
  const { totalStagesForGroupId } = useGroups();
  const {
    keyboardSoundEnabled,
    setKeyboardSoundEnabled,
    autoPronunciationEnabled,
    autoPronunciationRepeat,
    pronunciationAccent,
    autoConfusablePromptEnabled,
  } = useWordReviewUi();
  const totalStages = totalStagesForGroupId(word.group_id);
  const [input, setInput] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createConfusableOpen, setCreateConfusableOpen] = useState(false);
  const [generatingExample, setGeneratingExample] = useState(false);
  const [generateExampleError, setGenerateExampleError] = useState("");
  const [isPlayingPronunciation, setIsPlayingPronunciation] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [confusablePrompt, setConfusablePrompt] =
    useState<ConfusablePairFromReviewPreview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekResetDoneRef = useRef(false);
  const confusablePromptedRef = useRef<Set<string>>(new Set());

  const resetCardState = () => {
    setInput("");
    setWrongCount(0);
    setHasError(false);
    setIsCorrect(false);
    setRevealedAnswer(false);
    setConfusablePrompt(null);
    confusablePromptedRef.current = new Set();
    setGenerateExampleError("");
  };

  const reviewExample = useMemo(
    () => pickReviewExample(word.examples, word.word, word.id),
    [word.examples, word.word, word.id]
  );

  const exampleCount = useMemo(
    () => wordExamplesFromWord(word).filter((item) => item.en.trim() || item.zh.trim()).length,
    [word]
  );

  const handleGenerateExample = useCallback(async () => {
    if (exampleCount >= 1) {
      return;
    }
    setGeneratingExample(true);
    setGenerateExampleError("");
    try {
      const res = await aiApi.generateWordExample({
        word: word.word,
        meaning: word.meaning,
        pos: word.pos,
        phonetic: word.phonetic,
        existing_examples: [],
      });
      const next = sanitizeWordExamples([res.data]);
      const updated = await wordApi.update(word.id, {
        word: word.word,
        phonetic: word.phonetic,
        pos: word.pos,
        meaning: word.meaning,
        examples: next,
        example: next[0]?.en ?? "",
        example_translation: next[0]?.zh ?? "",
        group_id: word.group_id,
      });
      onWordUpdated?.({
        ...word,
        ...updated.data,
      });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "生成例句失败";
      setGenerateExampleError(typeof detail === "string" ? detail : "生成例句失败");
    } finally {
      setGeneratingExample(false);
    }
  }, [exampleCount, onWordUpdated, word]);

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
    setIsPlayingPronunciation(false);
    fadeIn();
    return clearFadeTimer;
  }, [word.id]);

  const handlePlayPronunciation = useCallback(async () => {
    setIsPlayingPronunciation(true);
    await playWordPronunciation(word.word, pronunciationAccent);
    setIsPlayingPronunciation(false);
  }, [word.word, pronunciationAccent]);

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
      setIsPlayingPronunciation(false);
      fadeIn();
      fadeTimerRef.current = null;
    }, FADE_MS);
  };

  const peeked = revealedAnswer || wrongCount >= 3;

  const reviewMeta = useMemo(() => {
    if (peeked) {
      const today = todayStr();
      return {
        stageIndex: 0,
        dueDate: today,
        overdueDays: 0,
      };
    }
    return {
      stageIndex: word.stage_index,
      dueDate: word.due_date,
      overdueDays: word.overdue_days,
    };
  }, [peeked, word.stage_index, word.due_date, word.overdue_days]);

  useEffect(() => {
    if (!peeked || peekResetDoneRef.current || isTransitioning) return;
    peekResetDoneRef.current = true;
    onPeekAnswer(word.id);
  }, [peeked, word.id, onPeekAnswer, isTransitioning]);

  const advanceAfterCorrect = useCallback(
    (_key: string) => {
      if (isTransitioning || !isCorrect) return;
      stopWordPronunciation();
      setIsPlayingPronunciation(false);
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

      if (key === "p") {
        e.preventDefault();
        void handlePlayPronunciation();
        return;
      }

      if (key === "o" && onToggleWordOrder) {
        e.preventDefault();
        onToggleWordOrder();
        return;
      }

      if (key === "e") {
        e.preventDefault();
        if (!isTransitioning && exampleCount === 0 && !generatingExample) {
          void handleGenerateExample();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isCorrect,
    isTransitioning,
    keyboardSoundEnabled,
    setKeyboardSoundEnabled,
    onToggleWordOrder,
    handlePlayPronunciation,
    exampleCount,
    generatingExample,
    handleGenerateExample,
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
      if (autoPronunciationEnabled) {
        setIsPlayingPronunciation(true);
        void playWordPronunciationRepeated(
          word.word,
          autoPronunciationRepeat,
          pronunciationAccent
        ).finally(() => setIsPlayingPronunciation(false));
      }
      return;
    }

    setHasError(true);
    if (!peeked) {
      setWrongCount((count) => count + 1);
      if (autoConfusablePromptEnabled) {
        const promptKey = `${word.id}:${answer.toLowerCase()}`;
        if (!confusablePromptedRef.current.has(promptKey)) {
          confusablePromptedRef.current.add(promptKey);
          void confusablePairApi
            .previewFromReview(word.id, answer)
            .then((res) => {
              if (res.data.eligible) {
                setConfusablePrompt(res.data);
              }
            })
            .catch(() => {});
        }
      }
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
    stopWordPronunciation();
    setIsPlayingPronunciation(false);
    transitionToNext(() => onSkip(word.id));
  };

  const progressPercent =
    totalCount > 0 ? Math.min(100, ((currentIndex + 1) / totalCount) * 100) : 0;

  return (
    <div
      className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl ${
        word.overdue_days > 0
          ? "ring-1 ring-red-200/80 dark:ring-red-900/50"
          : ""
      }`}
    >
      <div className="shrink-0 px-2 pt-1 sm:px-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
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
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ease-in-out ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
      <div className="flex shrink-0 items-center justify-between gap-3 px-2 py-2 sm:px-4">
        <div>
          <CardKindBadge kind="word" />
          <span className="ml-2 inline-block rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
            {groupLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePlayPronunciation()}
            disabled={isPlayingPronunciation || isTransitioning}
            title={`播放读音（${pronunciationAccent === "us" ? "美音" : "英音"}）`}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              isPlayingPronunciation
                ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <span aria-hidden>{isPlayingPronunciation ? "🔉" : "🔊"}</span>
            读音
          </button>
          {onToggleWordOrder && (
            <button
              type="button"
              onClick={onToggleWordOrder}
              title="切换单词顺序（Ctrl + O）"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                wordOrderMode === "shuffle"
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {wordOrderMode === "shuffle" ? "乱序" : "顺序"}
            </button>
          )}
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
          {exampleCount === 0 && (
            <button
              type="button"
              onClick={() => void handleGenerateExample()}
              disabled={generatingExample || isTransitioning}
              title="AI 生成例句并添加到卡片（Ctrl + E）"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                generatingExample
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
              }`}
            >
              {generatingExample ? "生成中..." : "生成例句"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateConfusableOpen(true)}
            disabled={isTransitioning}
            title="与当前单词组成易混词对"
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            增加易混词
          </button>
          <IconButton
            title="编辑单词"
            onClick={() => setEditModalOpen(true)}
            disabled={isTransitioning}
            className="h-7 w-7 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
          >
            <EditIcon />
          </IconButton>
        </div>
      </div>

      <WordEditModal
        word={word}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSaved={(updated) => {
          onWordUpdated?.({
            ...word,
            ...updated,
          });
        }}
      />

      {confusablePrompt && (
        <ConfusablePairPromptModal
          sourceWordId={word.id}
          preview={confusablePrompt}
          correctMeaning={word.meaning}
          onClose={() => setConfusablePrompt(null)}
        />
      )}

      <ConfusablePairCreateModal
        open={createConfusableOpen}
        onClose={() => setCreateConfusableOpen(false)}
        initialWordA={word.word}
        lockWordA
      />

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col justify-start"
      >
        <div className="flex flex-col items-center px-4 pb-4 pt-2 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
              第 {reviewMeta.stageIndex + 1}/{totalStages} 轮
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              应复习于 {reviewMeta.dueDate}
            </span>
            {reviewMeta.overdueDays > 0 && (
              <span className="font-medium text-red-500">
                逾期 {reviewMeta.overdueDays} 天
              </span>
            )}
          </div>

          <div
            className={`max-w-3xl text-center ${reviewExample ? "mb-3" : "mb-5"}`}
          >
            <p className="text-2xl font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
              {word.meaning}
            </p>
            {word.phonetic && showPhonetic && (
              <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
                {word.phonetic}
              </p>
            )}
            {exampleCount === 0 && generateExampleError && (
              <p className="mt-2 text-xs text-red-500">{generateExampleError}</p>
            )}
          </div>

          {reviewExample && (
            <ReviewExampleSentence
              example={reviewExample}
              word={word.word}
              showFull={isCorrect}
            />
          )}

          {(wrongCount >= 3 || revealedAnswer) && !isCorrect && (
            <p className="mb-5 rounded-lg bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {word.word}
              {word.phonetic && (
                <span className="ml-2 font-normal text-amber-700 dark:text-amber-300">
                  {word.phonetic}
                </span>
              )}
            </p>
          )}

          {isCorrect ? (
            <div className={`text-center ${reviewExample ? "mt-1" : ""}`}>
              <p className="mb-2 text-sm font-medium text-green-700 dark:text-green-400">
                回答正确
              </p>
              <p className="text-3xl font-semibold text-green-800 dark:text-green-300">
                {word.word}
              </p>
              {word.phonetic && (
                <p className="mt-2 text-base text-green-700 dark:text-green-400">
                  {word.phonetic}
                </p>
              )}
            </div>
          ) : (
            <div className={`w-full max-w-2xl ${reviewExample ? "mt-1" : ""}`}>
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

          <div className="mt-5 flex justify-center gap-3">
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

      <ShortcutHints />
    </div>
  );
}
