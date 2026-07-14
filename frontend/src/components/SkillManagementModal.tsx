import { CloseIcon } from "./ItemIcons";
import SkillManagementPanel from "./SkillManagementPanel";

interface SkillManagementModalProps {
  onClose: () => void;
}

export default function SkillManagementModal({ onClose }: SkillManagementModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Agent 技能管理</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              AI 助手可按需加载这些专项指令；也可在对话中让 AI 自动生成
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <SkillManagementPanel />
        </div>
      </div>
    </div>
  );
}
