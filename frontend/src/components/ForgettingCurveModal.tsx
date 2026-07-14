import type { Item } from "../types";
import ForgettingCurve from "./ForgettingCurve";
import { CloseIcon } from "./ItemIcons";

interface ForgettingCurveModalProps {
  item: Item;
  onClose: () => void;
}

export default function ForgettingCurveModal({
  item,
  onClose,
}: ForgettingCurveModalProps) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">艾宾浩斯遗忘曲线</h2>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <ForgettingCurve item={item} />
        </div>
      </div>
    </div>
  );
}
