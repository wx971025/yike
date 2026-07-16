const STORAGE_KEY = "word-review-keyboard-sound";

let keyboardSoundEnabled = true;

function loadSoundPreference(): void {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    keyboardSoundEnabled = saved === "1";
  }
}

loadSoundPreference();

export function isKeyboardSoundEnabled(): boolean {
  return keyboardSoundEnabled;
}

export function setKeyboardSoundEnabled(enabled: boolean): void {
  keyboardSoundEnabled = enabled;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }
}

// 音效来源：BigSoundBank (CC0 / 公有领域)
// - typewriter-key.ogg  #2842 Hermes Precisa 305 单键
// - typewriter-space.ogg #2843 空格键
// - typewriter-bell.ogg  #2844 换行铃

const SOUND_URLS = {
  key: "/sounds/typewriter-key.ogg",
  space: "/sounds/typewriter-space.ogg",
  bell: "/sounds/typewriter-bell.ogg",
} as const;

type SoundName = keyof typeof SOUND_URLS;

let audioContext: AudioContext | null = null;
const bufferCache: Partial<Record<SoundName, AudioBuffer>> = {};
const loadingPromises: Partial<Record<SoundName, Promise<AudioBuffer | null>>> =
  {};

async function getAudioContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;

  if (!audioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return null;
    }
  }

  return audioContext;
}

async function loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
  if (bufferCache[name]) return bufferCache[name]!;

  if (!loadingPromises[name]) {
    loadingPromises[name] = (async () => {
      const ctx = await getAudioContext();
      if (!ctx) return null;
      try {
        const response = await fetch(SOUND_URLS[name]);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        bufferCache[name] = buffer;
        return buffer;
      } catch {
        return null;
      }
    })();
  }

  return loadingPromises[name]!;
}

async function playSample(
  name: SoundName,
  options?: { volume?: number; playbackRate?: number }
): Promise<void> {
  if (!keyboardSoundEnabled) return;

  const ctx = await getAudioContext();
  const buffer = await loadBuffer(name);
  if (!ctx || !buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options?.playbackRate ?? 1;

  const gain = ctx.createGain();
  gain.gain.value = options?.volume ?? 0.88;

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

/** 打字机单键（实录） */
export async function playTypewriterSound(): Promise<void> {
  await playSample("key", {
    volume: 0.92,
    playbackRate: 0.94 + Math.random() * 0.1,
  });
}

/** 退格：同键音略低沉 */
export async function playBackspaceSound(): Promise<void> {
  await playSample("key", {
    volume: 0.78,
    playbackRate: 0.8 + Math.random() * 0.06,
  });
}

/** 回车确认：低沉轻柔的击键音（避免铃声过尖） */
export async function playEnterSound(): Promise<void> {
  await playSample("key", {
    volume: 0.55,
    playbackRate: 0.7 + Math.random() * 0.04,
  });
}

/** 空格确认：空格键实录 */
export async function playSpaceConfirmSound(): Promise<void> {
  await playSample("space", {
    volume: 0.9,
    playbackRate: 0.96 + Math.random() * 0.08,
  });
}

/** 预加载并唤醒音频，避免第二次按键时无声 */
export async function warmUpKeyboardSounds(): Promise<void> {
  if (!keyboardSoundEnabled) return;
  await getAudioContext();
  await Promise.all([
    loadBuffer("key"),
    loadBuffer("space"),
  ]);
}
