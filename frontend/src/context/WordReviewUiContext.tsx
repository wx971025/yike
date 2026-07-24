import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  isKeyboardSoundEnabled,
  setKeyboardSoundEnabled as persistKeyboardSound,
} from "../utils/wordReviewSounds";
import {
  isAutoConfusablePromptEnabled,
  setAutoConfusablePromptEnabled as persistAutoConfusablePrompt,
} from "../utils/wordReviewConfusable";
import {
  getAutoPronunciationRepeat,
  getPronunciationAccent,
  isAutoPronunciationEnabled,
  setAutoPronunciationEnabled as persistAutoPronunciation,
  setAutoPronunciationRepeat as persistAutoPronunciationRepeat,
  togglePronunciationAccent as persistTogglePronunciationAccent,
  type PronunciationAccent,
} from "../utils/wordPronunciation";
import {
  REVIEW_SETTINGS_APPLIED_EVENT,
  scheduleReviewSettingsSync,
} from "../utils/reviewSettingsSync";

interface WordReviewUiState {
  keyboardSoundEnabled: boolean;
  setKeyboardSoundEnabled: (enabled: boolean) => void;
  autoPronunciationEnabled: boolean;
  setAutoPronunciationEnabled: (enabled: boolean) => void;
  autoPronunciationRepeat: number;
  setAutoPronunciationRepeat: (count: number) => void;
  pronunciationAccent: PronunciationAccent;
  togglePronunciationAccent: () => void;
  autoConfusablePromptEnabled: boolean;
  setAutoConfusablePromptEnabled: (enabled: boolean) => void;
}

const WordReviewUiContext = createContext<WordReviewUiState | undefined>(
  undefined
);

export function WordReviewUiProvider({ children }: { children: ReactNode }) {
  const [keyboardSoundEnabled, setKeyboardSoundEnabledState] = useState(
    isKeyboardSoundEnabled
  );
  const [autoPronunciationEnabled, setAutoPronunciationEnabledState] = useState(
    isAutoPronunciationEnabled
  );
  const [autoPronunciationRepeat, setAutoPronunciationRepeatState] = useState(
    getAutoPronunciationRepeat
  );
  const [pronunciationAccent, setPronunciationAccentState] = useState(
    getPronunciationAccent
  );
  const [autoConfusablePromptEnabled, setAutoConfusablePromptEnabledState] =
    useState(isAutoConfusablePromptEnabled);

  useEffect(() => {
    const refresh = () => {
      setKeyboardSoundEnabledState(isKeyboardSoundEnabled());
      setAutoPronunciationEnabledState(isAutoPronunciationEnabled());
      setAutoPronunciationRepeatState(getAutoPronunciationRepeat());
      setPronunciationAccentState(getPronunciationAccent());
      setAutoConfusablePromptEnabledState(isAutoConfusablePromptEnabled());
    };
    window.addEventListener(REVIEW_SETTINGS_APPLIED_EVENT, refresh);
    return () =>
      window.removeEventListener(REVIEW_SETTINGS_APPLIED_EVENT, refresh);
  }, []);

  const setKeyboardSoundEnabled = (enabled: boolean) => {
    persistKeyboardSound(enabled);
    setKeyboardSoundEnabledState(enabled);
    scheduleReviewSettingsSync();
  };

  const setAutoPronunciationEnabled = (enabled: boolean) => {
    persistAutoPronunciation(enabled);
    setAutoPronunciationEnabledState(enabled);
    scheduleReviewSettingsSync();
  };

  const setAutoPronunciationRepeat = (count: number) => {
    persistAutoPronunciationRepeat(count);
    setAutoPronunciationRepeatState(getAutoPronunciationRepeat());
    scheduleReviewSettingsSync();
  };

  const togglePronunciationAccent = () => {
    const next = persistTogglePronunciationAccent();
    setPronunciationAccentState(next);
    scheduleReviewSettingsSync();
  };

  const setAutoConfusablePromptEnabled = (enabled: boolean) => {
    persistAutoConfusablePrompt(enabled);
    setAutoConfusablePromptEnabledState(enabled);
    scheduleReviewSettingsSync();
  };

  return (
    <WordReviewUiContext.Provider
      value={{
        keyboardSoundEnabled,
        setKeyboardSoundEnabled,
        autoPronunciationEnabled,
        setAutoPronunciationEnabled,
        autoPronunciationRepeat,
        setAutoPronunciationRepeat,
        pronunciationAccent,
        togglePronunciationAccent,
        autoConfusablePromptEnabled,
        setAutoConfusablePromptEnabled,
      }}
    >
      {children}
    </WordReviewUiContext.Provider>
  );
}

export function useWordReviewUi() {
  const ctx = useContext(WordReviewUiContext);
  if (!ctx) {
    throw new Error("useWordReviewUi must be used within WordReviewUiProvider");
  }
  return ctx;
}
