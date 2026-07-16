import type { WordExample } from "../types";

export const CLOZE_BLANK_WIDTH_CH = 10;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitSentenceForCloze(
  sentence: string,
  word: string
): { before: string; after: string; matched: string } | null {
  const trimmedWord = word.trim();
  if (!sentence.trim() || !trimmedWord) return null;

  const regex = new RegExp(`\\b(${escapeRegex(trimmedWord)})\\b`, "i");
  const match = regex.exec(sentence);
  if (!match || match.index === undefined) return null;

  return {
    before: sentence.slice(0, match.index),
    after: sentence.slice(match.index + match[0].length),
    matched: match[0],
  };
}

export function pickReviewExample(
  examples: WordExample[] | undefined,
  word: string,
  seed: number
): WordExample | null {
  const candidates = (examples ?? []).filter(
    (item) => item.en.trim() && splitSentenceForCloze(item.en, word)
  );
  if (candidates.length === 0) return null;
  return candidates[Math.abs(seed) % candidates.length];
}
