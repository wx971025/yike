import { useCallback, useEffect, useState } from "react";
import { skillApi } from "../api";
import type { SkillCatalog } from "../types";
import { DeleteIcon } from "./ItemIcons";

export default function SkillManagementPanel() {
  const [skills, setSkills] = useState<SkillCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailContent, setDetailContent] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await skillApi.list();
      setSkills(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除 Skill「${name}」？删除后 AI 将无法再加载该指令。`)) return;
    setDeletingId(id);
    try {
      await skillApi.remove(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = async (skill: SkillCatalog) => {
    if (expandedId === skill.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(skill.id);
    if (!detailContent[skill.id]) {
      const res = await skillApi.get(skill.id);
      setDetailContent((prev) => ({ ...prev, [skill.id]: res.data.content }));
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">加载中...</p>;
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-16 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">暂无 Agent 技能</p>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          在 AI 助手中说「帮我创建一个 skill，以后批量添加单词时…」即可自动生成
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <div
          key={skill.id}
          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
        >
          <div className="flex items-start gap-3 px-4 py-4">
            <button
              type="button"
              onClick={() => toggleExpand(skill)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="font-medium text-slate-800 dark:text-slate-100">{skill.name}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{skill.description}</div>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(skill.id, skill.name)}
              disabled={deletingId === skill.id}
              className="shrink-0 rounded-lg p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
              title="删除"
            >
              <DeleteIcon />
            </button>
          </div>
          {expandedId === skill.id && detailContent[skill.id] && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {detailContent[skill.id]}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
