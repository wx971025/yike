const STORAGE_KEY = "word-auto-confusable-prompt";

let autoConfusablePromptEnabled = true;

function loadPreference(): void {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    autoConfusablePromptEnabled = saved === "1";
  }
}

loadPreference();

export function isAutoConfusablePromptEnabled(): boolean {
  return autoConfusablePromptEnabled;
}

export function setAutoConfusablePromptEnabled(enabled: boolean): void {
  autoConfusablePromptEnabled = enabled;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }
}
