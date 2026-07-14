interface PlanMultiSelectBarProps {
  visible: boolean;
  selectedCount: number;
  loading: boolean;
  onCancel: () => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onEditGroup?: () => void;
  onDelete?: () => void;
  leaveLabel?: string;
}

export function MultiSelectToggleButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
      }`}
    >
      {active ? "取消多选" : "多选"}
    </button>
  );
}

export default function PlanMultiSelectBar({
  visible,
  selectedCount,
  loading,
  onCancel,
  onJoin,
  onLeave,
  onEditGroup,
  onDelete,
  leaveLabel = "移出计划",
}: PlanMultiSelectBarProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:gap-3">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          已选 <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{selectedCount}</span> 项
        </span>
        {onJoin && (
          <button
            type="button"
            onClick={onJoin}
            disabled={loading || selectedCount === 0}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {loading ? "处理中..." : "加入计划"}
          </button>
        )}
        {onLeave && (
          <button
            type="button"
            onClick={onLeave}
            disabled={loading || selectedCount === 0}
            className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-50 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
          >
            {loading ? "处理中..." : leaveLabel}
          </button>
        )}
        {onEditGroup && (
          <button
            type="button"
            onClick={onEditGroup}
            disabled={loading || selectedCount === 0}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
          >
            {loading ? "处理中..." : "编辑分组"}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={loading || selectedCount === 0}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {loading ? "处理中..." : "删除"}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      aria-label={ariaLabel}
      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
    />
  );
}
