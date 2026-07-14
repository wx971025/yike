import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  isKeyboardSoundEnabled,
  setKeyboardSoundEnabled as persistKeyboardSound,
} from "../utils/wordReviewSounds";

interface WordReviewUiState {
  keyboardSoundEnabled: boolean;
  setKeyboardSoundEnabled: (enabled: boolean) => void;
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;
}

const WordReviewUiContext = createContext<WordReviewUiState | undefined>(
  undefined
);

export function WordReviewUiProvider({ children }: { children: ReactNode }) {
  const [keyboardSoundEnabled, setKeyboardSoundEnabledState] = useState(
    isKeyboardSoundEnabled
  );
  const [focusMode, setFocusMode] = useState(false);

  const setKeyboardSoundEnabled = (enabled: boolean) => {
    persistKeyboardSound(enabled);
    setKeyboardSoundEnabledState(enabled);
  };

  return (
    <WordReviewUiContext.Provider
      value={{
        keyboardSoundEnabled,
        setKeyboardSoundEnabled,
        focusMode,
        setFocusMode,
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
