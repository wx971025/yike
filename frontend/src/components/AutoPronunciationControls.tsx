import { useWordReviewUi } from "../context/WordReviewUiContext";

interface AutoPronunciationControlsProps {
  className?: string;
  buttonClassName?: string;
}

export default function AutoPronunciationControls({
  className = "",
  buttonClassName = "px-3 py-2 text-sm",
}: AutoPronunciationControlsProps) {
  const {
    autoPronunciationEnabled,
    setAutoPronunciationEnabled,
    autoPronunciationRepeat,
    setAutoPronunciationRepeat,
  } = useWordReviewUi();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => setAutoPronunciationEnabled(!autoPronunciationEnabled)}
        className={`flex items-center gap-1.5 rounded-lg font-medium transition ${buttonClassName} ${
          autoPronunciationEnabled
            ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
        title={
          autoPronunciationEnabled
            ? "答对后自动朗读，点击关闭"
            : "点击开启答对后自动朗读"
        }
      >
        <span aria-hidden>{autoPronunciationEnabled ? "🗣️" : "🔈"}</span>
        自动读音
      </button>
      {autoPronunciationEnabled && (
        <div
          className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800"
          title="答对后朗读次数，每隔 2 秒读一遍"
        >
          <button
            type="button"
            onClick={() =>
              setAutoPronunciationRepeat(autoPronunciationRepeat - 1)
            }
            disabled={autoPronunciationRepeat <= 1}
            className="rounded-l-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="减少朗读次数"
          >
            −
          </button>
          <span className="min-w-[2.5rem] px-1 text-center text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
            {autoPronunciationRepeat}遍
          </span>
          <button
            type="button"
            onClick={() =>
              setAutoPronunciationRepeat(autoPronunciationRepeat + 1)
            }
            disabled={autoPronunciationRepeat >= 5}
            className="rounded-r-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="增加朗读次数"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
