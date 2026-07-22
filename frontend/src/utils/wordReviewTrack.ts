import type { Word } from "../types";

export type WordReviewTrack = "spell" | "recognize";

export function wordTrackState(word: Word, track: WordReviewTrack) {
  if (track === "spell") {
    return {
      learned_at: word.spell_learned_at,
      stage_index: word.spell_stage_index,
      stage_status: word.spell_stage_status,
      status: word.spell_status,
      last_reviewed_at: word.spell_last_reviewed_at,
      skipped_at: word.spell_skipped_at,
    };
  }
  return {
    learned_at: word.rec_learned_at,
    stage_index: word.rec_stage_index,
    stage_status: word.rec_stage_status,
    status: word.rec_status,
    last_reviewed_at: word.rec_last_reviewed_at,
    skipped_at: word.rec_skipped_at,
  };
}

export function wordTrackLabel(track: WordReviewTrack): string {
  return track === "spell" ? "拼写" : "认知";
}
