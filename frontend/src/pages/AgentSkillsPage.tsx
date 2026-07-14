import SkillManagementPanel from "../components/SkillManagementPanel";

export default function AgentSkillsPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Agent 技能管理</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          管理 AI 助手可按需加载的专项技能；也可在对话中让 AI 自动生成
        </p>
      </div>
      <SkillManagementPanel />
    </div>
  );
}
