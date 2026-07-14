import { useEffect, useMemo, useState } from "react";
import { groupApi } from "../api";
import { DeleteIcon, EditIcon, IconButton } from "../components/ItemIcons";
import SearchBox from "../components/SearchBox";
import { useGroups } from "../context/GroupContext";
import { MEMORY_MODES, type MemoryMode } from "../types";
import {
  sortByName,
  toggleSortDirection,
  type SortDirection,
} from "../utils/sort";

export default function GroupsPage() {
  const {
    groups,
    refreshGroups,
    selectedGroupId,
    setSelectedGroupId,
    memoryModeLabelForGroupId,
  } = useGroups();
  const [name, setName] = useState("");
  const [createMemoryMode, setCreateMemoryMode] = useState<MemoryMode>("ebbinghaus");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingMemoryMode, setEditingMemoryMode] = useState<MemoryMode>("ebbinghaus");
  const [search, setSearch] = useState("");
  const [nameSort, setNameSort] = useState<SortDirection>("asc");

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? groups.filter((g) => g.name.toLowerCase().includes(keyword))
      : groups;
    return sortByName(matched, nameSort);
  }, [groups, search, nameSort]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await groupApi.create(name.trim(), createMemoryMode);
    setName("");
    setCreateMemoryMode("ebbinghaus");
    await refreshGroups();
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) return;
    await groupApi.update(id, {
      name: editingName.trim(),
      memory_mode: editingMemoryMode,
    });
    setEditingId(null);
    await refreshGroups();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("删除分组会同时删除组内所有卡片和单词，确定继续？")) return;
    await groupApi.remove(id);
    if (selectedGroupId === id) setSelectedGroupId(null);
    await refreshGroups();
  };

  useEffect(() => {
    const handler = () => refreshGroups();
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [refreshGroups]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">分组管理</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          用分组归类学习卡片和单词；同一分组共用一种记忆方式
        </p>
      </div>

      <form onSubmit={handleCreate} className="mb-5 space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新建分组名称"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            添加
          </button>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
            记忆方式
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {MEMORY_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setCreateMemoryMode(mode.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  createMemoryMode === mode.value
                    ? "border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                <div>{mode.label}</div>
                <div className="mt-0.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                  {mode.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="按名称搜索分组..." />
        <button
          type="button"
          onClick={() => setNameSort(toggleSortDirection(nameSort))}
          className="shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          名称排序 {nameSort === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-16 text-center text-slate-400 dark:text-slate-500">
          {search.trim() ? "没有匹配的分组" : "还没有分组"}
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredGroups.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3"
            >
              {editingId === g.id ? (
                <div className="space-y-3">
                  <input
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MEMORY_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setEditingMemoryMode(mode.value)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          editingMemoryMode === mode.value
                            ? "border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleSaveEdit(g.id)}
                      className="text-green-600 hover:underline"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-slate-400 dark:text-slate-500 hover:underline"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-700 dark:text-slate-200">{g.name}</div>
                    <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {memoryModeLabelForGroupId(g.id)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      title="编辑"
                      onClick={() => {
                        setEditingId(g.id);
                        setEditingName(g.name);
                        setEditingMemoryMode(g.memory_mode ?? "ebbinghaus");
                      }}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      title="删除"
                      onClick={() => handleDelete(g.id)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
