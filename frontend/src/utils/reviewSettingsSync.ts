import { authApi } from "../api";
import type { User } from "../types";
import {
  isAutoConfusablePromptEnabled,
  setAutoConfusablePromptEnabled,
} from "./wordReviewConfusable";
import {
  getAutoPronunciationRepeat,
  getPronunciationAccent,
  isAutoPronunciationEnabled,
  setAutoPronunciationEnabled,
  setAutoPronunciationRepeat,
  setPronunciationAccent,
  type PronunciationAccent,
} from "./wordPronunciation";
import {
  loadWordOrderMode,
  saveWordOrderMode,
  type WordOrderMode,
} from "./wordReviewOrder";
import {
  isKeyboardSoundEnabled,
  setKeyboardSoundEnabled,
} from "./wordReviewSounds";

export interface ReviewUiPrefs {
  keyboard_sound_enabled?: boolean;
  auto_pronunciation_enabled?: boolean;
  auto_pronunciation_repeat?: number;
  pronunciation_accent?: PronunciationAccent;
  auto_confusable_prompt_enabled?: boolean;
}

export function collectReviewUiPrefs(): ReviewUiPrefs {
  return {
    keyboard_sound_enabled: isKeyboardSoundEnabled(),
    auto_pronunciation_enabled: isAutoPronunciationEnabled(),
    auto_pronunciation_repeat: getAutoPronunciationRepeat(),
    pronunciation_accent: getPronunciationAccent(),
    auto_confusable_prompt_enabled: isAutoConfusablePromptEnabled(),
  };
}

export function applyReviewUiPrefs(prefs: ReviewUiPrefs | null | undefined): void {
  if (!prefs) return;
  if (typeof prefs.keyboard_sound_enabled === "boolean") {
    setKeyboardSoundEnabled(prefs.keyboard_sound_enabled);
  }
  if (typeof prefs.auto_pronunciation_enabled === "boolean") {
    setAutoPronunciationEnabled(prefs.auto_pronunciation_enabled);
  }
  if (typeof prefs.auto_pronunciation_repeat === "number") {
    setAutoPronunciationRepeat(prefs.auto_pronunciation_repeat);
  }
  if (prefs.pronunciation_accent === "us" || prefs.pronunciation_accent === "uk") {
    setPronunciationAccent(prefs.pronunciation_accent);
  }
  if (typeof prefs.auto_confusable_prompt_enabled === "boolean") {
    setAutoConfusablePromptEnabled(prefs.auto_confusable_prompt_enabled);
  }
}

export const REVIEW_SETTINGS_APPLIED_EVENT = "yike:review-settings-applied";

export function applyReviewSettingsFromUser(user: User | null | undefined): void {
  if (!user) return;
  const mode = user.word_review_order_mode;
  if (mode === "shuffle" || mode === "created_at") {
    saveWordOrderMode(mode);
  }
  applyReviewUiPrefs(user.review_ui_prefs ?? undefined);
  window.dispatchEvent(new CustomEvent(REVIEW_SETTINGS_APPLIED_EVENT));
}

export function resolveWordOrderMode(user: User | null | undefined): WordOrderMode {
  const mode = user?.word_review_order_mode;
  if (mode === "shuffle" || mode === "created_at") {
    return mode;
  }
  return loadWordOrderMode();
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleReviewSettingsSync(
  partial?: Partial<{
    word_review_order_mode: WordOrderMode;
    review_ui_prefs: ReviewUiPrefs;
  }>
): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void authApi
      .updateProfile({
        word_review_order_mode: partial?.word_review_order_mode,
        review_ui_prefs: (partial?.review_ui_prefs ??
          collectReviewUiPrefs()) as Record<string, unknown>,
      })
      .catch(() => {});
  }, 400);
}

export function syncReviewSettingsNow(
  partial?: Partial<{
    word_review_order_mode: WordOrderMode;
    review_ui_prefs: ReviewUiPrefs;
  }>
): Promise<User | void> {
  return authApi
    .updateProfile({
      word_review_order_mode: partial?.word_review_order_mode,
      review_ui_prefs: (partial?.review_ui_prefs ??
        collectReviewUiPrefs()) as Record<string, unknown>,
    })
    .then((res) => res.data)
    .catch(() => {});
}
