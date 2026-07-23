import { useEffect, useRef, useState } from "react";
import { authApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useWordReviewUi } from "../context/WordReviewUiContext";
import { GearIcon, IconButton } from "./ItemIcons";

type WordOrderMode = "shuffle" | "created_at";

interface WordReviewSettingsMenuProps {
  showWordOrder?: boolean;
  wordOrderMode?: WordOrderMode;
  onToggleWordOrder?: () => void;
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200">{label}</p>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  activeLabel,
  inactiveLabel,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  activeLabel: string;
  inactiveLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        active
          ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

export default function WordReviewSettingsMenu({
  showWordOrder = false,
  wordOrderMode = "shuffle",
  onToggleWordOrder,
}: WordReviewSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [savingCap, setSavingCap] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, updateUser } = useAuth();
  const dailyCap = user?.word_review_daily_cap ?? null;
  const {
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
  } = useWordReviewUi();

  const saveDailyCap = async (next: number | null) => {
    if (savingCap) return;
    setSavingCap(true);
    try {
      const res = await authApi.updateProfile({ word_review_daily_cap: next });
      updateUser(res.data);
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } finally {
      setSavingCap(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            复习设置
          </p>
          {showWordOrder && onToggleWordOrder && (
            <SettingRow label="单词顺序">
              <ToggleButton
                active={wordOrderMode === "shuffle"}
                onClick={onToggleWordOrder}
                activeLabel="乱序"
                inactiveLabel="顺序"
              />
            </SettingRow>
          )}
          <SettingRow
            label="每日复习上限"
            description="拼写、认知各自最多 N 个，按逾期优先"
          >
            <div className="flex flex-col items-end gap-1.5">
              <ToggleButton
                active={dailyCap === null}
                onClick={() => void saveDailyCap(dailyCap === null ? 10 : null)}
                activeLabel="不限"
                inactiveLabel="限制"
                disabled={savingCap}
              />
              {dailyCap !== null && (
                <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => void saveDailyCap(Math.max(10, dailyCap - 1))}
                    disabled={savingCap || dailyCap <= 10}
                    className="rounded-l-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                    aria-label="减少每日上限"
                  >
                    −
                  </button>
                  <span className="min-w-[3rem] px-1 text-center text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">
                    {dailyCap}个
                  </span>
                  <button
                    type="button"
                    onClick={() => void saveDailyCap(dailyCap + 1)}
                    disabled={savingCap}
                    className="rounded-r-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                    aria-label="增加每日上限"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </SettingRow>
          <SettingRow label="读音口音" description="播放单词读音">
            <ToggleButton
              active={pronunciationAccent === "us"}
              onClick={togglePronunciationAccent}
              activeLabel="美音"
              inactiveLabel="英音"
            />
          </SettingRow>
          <SettingRow
            label="自动弹出易混词"
            description="拼错时提示添加易混词对"
          >
            <ToggleButton
              active={autoConfusablePromptEnabled}
              onClick={() =>
                setAutoConfusablePromptEnabled(!autoConfusablePromptEnabled)
              }
              activeLabel="开启"
              inactiveLabel="关闭"
            />
          </SettingRow>
          <SettingRow label="键盘音">
            <ToggleButton
              active={keyboardSoundEnabled}
              onClick={() => setKeyboardSoundEnabled(!keyboardSoundEnabled)}
              activeLabel="开启"
              inactiveLabel="关闭"
            />
          </SettingRow>
          <SettingRow
            label="自动读音"
            description="答对后自动朗读"
          >
            <ToggleButton
              active={autoPronunciationEnabled}
              onClick={() => setAutoPronunciationEnabled(!autoPronunciationEnabled)}
              activeLabel="开启"
              inactiveLabel="关闭"
            />
          </SettingRow>
          {autoPronunciationEnabled && (
            <SettingRow label="朗读次数" description="每隔 2 秒读一遍">
              <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setAutoPronunciationRepeat(autoPronunciationRepeat - 1)
                  }
                  disabled={autoPronunciationRepeat <= 1}
                  className="rounded-l-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label="减少朗读次数"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] px-1 text-center text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">
                  {autoPronunciationRepeat}遍
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAutoPronunciationRepeat(autoPronunciationRepeat + 1)
                  }
                  disabled={autoPronunciationRepeat >= 5}
                  className="rounded-r-lg px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label="增加朗读次数"
                >
                  +
                </button>
              </div>
            </SettingRow>
          )}
        </div>
      )}
      <IconButton
        title="复习设置"
        onClick={() => setOpen((v) => !v)}
        className={
          open
            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }
      >
        <GearIcon />
      </IconButton>
    </div>
  );
}
