import type { Group } from "../types";

interface BulkGroupEditModalProps {
  open: boolean;
  selectedCount: number;
  groups: Group[];
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (groupId: number) => void;
}

export default function BulkGroupEditModal({
  open,
  selectedCount,
  groups,
  loading = false,
  error = "",
  onClose,
  onConfirm,
}: BulkGroupEditModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={loading ? undefined : onClose}
    >
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const value = formData.get("group_id");
          if (value == null || value === "") {
            return;
          }
          onConfirm(Number(value));
        }}
      >
        <h3 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          编辑分组
        </h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          将选中的 {selectedCount} 项移动到以下分组
        </p>

        {groups.length === 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            暂无可用分组，请先到分组管理创建
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          目标分组
        </label>
        <select
          name="group_id"
          defaultValue={groups[0]?.id ?? ""}
          disabled={loading || groups.length === 0}
          required
          className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading || groups.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "处理中..." : "确定"}
          </button>
        </div>
      </form>
    </div>
  );
}
