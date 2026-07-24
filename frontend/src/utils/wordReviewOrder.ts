import type { ReviewWord } from "../types";
import { sortByCreatedAt } from "./sort";

export type WordOrderMode = "shuffle" | "created_at";

const WORD_ORDER_MODE_KEY = "yike:word-order-mode";

export function loadWordOrderMode(): WordOrderMode {
  try {
    const raw = localStorage.getItem(WORD_ORDER_MODE_KEY);
    if (raw === "created_at" || raw === "shuffle") return raw;
  } catch {
    /* ignore */
  }
  return "shuffle";
}

export function saveWordOrderMode(mode: WordOrderMode): void {
  try {
    localStorage.setItem(WORD_ORDER_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWordOrderSeedKey(parts: {
  userId: number | null | undefined;
  track: string;
  today?: string;
  groupFilterKey?: string;
}): string {
  const today = parts.today ?? new Date().toISOString().slice(0, 10);
  return [
    parts.userId ?? "anon",
    today,
    parts.track,
    parts.groupFilterKey ?? "all",
  ].join(":");
}

export function orderReviewWords(
  words: ReviewWord[],
  mode: WordOrderMode,
  seedKey?: string,
  explicitSeed?: number | null
): ReviewWord[] {
  if (mode === "created_at") {
    return sortByCreatedAt(words, "asc");
  }
  if (words.length <= 1) {
    return words;
  }
  const seed =
    explicitSeed ??
    (seedKey ? hashSeed(`${seedKey}:shuffle`) : Date.now());
  const rng = mulberry32(seed >>> 0);
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function groupFilterSeedKey(groupIds: Set<number>): string {
  if (groupIds.size === 0) return "all";
  return [...groupIds].sort((a, b) => a - b).join(",");
}
