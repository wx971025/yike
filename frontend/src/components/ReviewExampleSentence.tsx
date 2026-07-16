import type { WordExample } from "../types";
import {
  CLOZE_BLANK_WIDTH_CH,
  splitSentenceForCloze,
} from "../utils/wordExampleCloze";

interface ReviewExampleSentenceProps {
  example: WordExample;
  word: string;
  showFull: boolean;
  className?: string;
}

export default function ReviewExampleSentence({
  example,
  word,
  showFull,
  className = "mb-5 max-w-3xl text-center",
}: ReviewExampleSentenceProps) {
  const cloze = splitSentenceForCloze(example.en, word);
  if (!cloze) return null;

  return (
    <div className={className}>
      <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
        {showFull ? (
          <>
            {cloze.before}
            <span className="rounded-sm bg-violet-100 px-0.5 font-semibold text-violet-800 dark:bg-violet-950/70 dark:text-violet-200">
              {cloze.matched}
            </span>
            {cloze.after}
          </>
        ) : (
          <>
            {cloze.before}
            <span
              className="mx-1 inline-block align-baseline border-b-2 border-slate-400 dark:border-slate-500"
              style={{ width: `${CLOZE_BLANK_WIDTH_CH}ch` }}
              aria-label="填空"
            />
            {cloze.after}
          </>
        )}
      </p>
      {example.zh.trim() && (
        <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {example.zh}
        </p>
      )}
    </div>
  );
}
