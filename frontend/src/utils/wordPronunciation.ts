const ACCENT_STORAGE_KEY = "word-pronunciation-accent";
const AUTO_ENABLED_KEY = "word-auto-pronunciation";
const AUTO_REPEAT_KEY = "word-auto-pronunciation-repeat";

export type PronunciationAccent = "us" | "uk";

let pronunciationAccent: PronunciationAccent = "us";
let autoPronunciationEnabled = true;
let autoPronunciationRepeat = 1;
let currentAudio: HTMLAudioElement | null = null;
let repeatSessionId = 0;
let repeatTimer: ReturnType<typeof setTimeout> | null = null;

function loadAccentPreference(): void {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
  if (saved === "us" || saved === "uk") {
    pronunciationAccent = saved;
  }
}

function loadAutoPronunciationPreferences(): void {
  if (typeof window === "undefined") return;
  const enabled = localStorage.getItem(AUTO_ENABLED_KEY);
  if (enabled !== null) {
    autoPronunciationEnabled = enabled === "1";
  }
  const repeat = localStorage.getItem(AUTO_REPEAT_KEY);
  if (repeat !== null) {
    const value = Number.parseInt(repeat, 10);
    if (value >= 1 && value <= 5) {
      autoPronunciationRepeat = value;
    }
  }
}

loadAccentPreference();
loadAutoPronunciationPreferences();

export function getPronunciationAccent(): PronunciationAccent {
  return pronunciationAccent;
}

export function setPronunciationAccent(accent: PronunciationAccent): void {
  pronunciationAccent = accent;
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }
}

export function togglePronunciationAccent(): PronunciationAccent {
  const next = pronunciationAccent === "us" ? "uk" : "us";
  setPronunciationAccent(next);
  return next;
}

export function isAutoPronunciationEnabled(): boolean {
  return autoPronunciationEnabled;
}

export function setAutoPronunciationEnabled(enabled: boolean): void {
  autoPronunciationEnabled = enabled;
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTO_ENABLED_KEY, enabled ? "1" : "0");
  }
}

export function getAutoPronunciationRepeat(): number {
  return autoPronunciationRepeat;
}

export function setAutoPronunciationRepeat(count: number): void {
  const value = Math.min(5, Math.max(1, Math.round(count)));
  autoPronunciationRepeat = value;
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTO_REPEAT_KEY, String(value));
  }
}

function youdaoAudioUrl(word: string, accent: PronunciationAccent): string {
  const type = accent === "us" ? "1" : "2";
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
}

function cancelRepeatSchedule(): void {
  repeatSessionId += 1;
  if (repeatTimer) {
    clearTimeout(repeatTimer);
    repeatTimer = null;
  }
}

function delay(ms: number, sessionId: number): Promise<boolean> {
  return new Promise((resolve) => {
    repeatTimer = setTimeout(() => {
      repeatTimer = null;
      resolve(sessionId === repeatSessionId);
    }, ms);
  });
}

export function stopWordPronunciation(): void {
  cancelRepeatSchedule();
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
}

async function playOnce(
  word: string,
  accent?: PronunciationAccent
): Promise<boolean> {
  const text = word.trim();
  if (!text || typeof window === "undefined") return false;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  const audio = new Audio(youdaoAudioUrl(text, accent ?? pronunciationAccent));
  currentAudio = audio;

  try {
    await audio.play();
    return true;
  } catch {
    currentAudio = null;
    return false;
  }
}

/** 播放有道外链读音，返回是否成功开始播放 */
export async function playWordPronunciation(
  word: string,
  accent?: PronunciationAccent
): Promise<boolean> {
  stopWordPronunciation();
  return playOnce(word, accent);
}

const AUTO_PRONUNCIATION_INTERVAL_MS = 2000;

/** 按固定间隔重复播放读音（答对后自动朗读） */
export async function playWordPronunciationRepeated(
  word: string,
  times: number,
  accent?: PronunciationAccent,
  intervalMs = AUTO_PRONUNCIATION_INTERVAL_MS
): Promise<void> {
  cancelRepeatSchedule();
  const sessionId = repeatSessionId;
  const count = Math.min(5, Math.max(1, Math.round(times)));

  for (let i = 0; i < count; i += 1) {
    if (sessionId !== repeatSessionId) return;
    await playOnce(word, accent);
    if (i >= count - 1) return;
    const stillActive = await delay(intervalMs, sessionId);
    if (!stillActive) return;
  }
}
