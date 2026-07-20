import { useEffect, useMemo, useState } from "react";
import { groupApi } from "../api";
import GroupColorPicker from "../components/GroupColorPicker";
import GroupTag from "../components/GroupTag";
import { DeleteIcon, EditIcon, IconButton } from "../components/ItemIcons";
import ScheduleModePicker, {
  defaultScheduleModeForCategory,
} from "../components/ScheduleModePicker";
import SearchBox from "../components/SearchBox";
import { useGroups } from "../context/GroupContext";
import { normalizeMemoryMode, type GroupCategory } from "../types";
import {
  GROUP_CATEGORY_OPTIONS,
} from "../utils/groupCategory";
import { presetColorForIndex } from "../utils/groupColor";
import { normalizeReminderMode } from "../utils/reminderSchedule";
import {
  sortByName,
  toggleSortDirection,
  type SortDirection,
} from "../utils/sort";

function scheduleModeForGroup(category: GroupCategory, memoryMode?: string | null) {
  if (category === "reminder") {
    return normalizeReminderMode(memoryMode);
  }
  return normalizeMemoryMode(memoryMode);
}

export default function GroupsPage() {
  const { groups, refreshGroups, scheduleLabelForGroupId } = useGroups();
  const [createCategory, setCreateCategory] = useState<GroupCategory>("memory_card");
  const [createScheduleMode, setCreateScheduleMode] = useState("ebbinghaus");
  const [name, setName] = useState("");
  const [createColor, setCreateColor] = useState(() => presetColorForIndex(0));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingScheduleMode, setEditingScheduleMode] = useState("ebbinghaus");
  const [editingColor, setEditingColor] = useState(() => presetColorForIndex(0));
  const [editingCategory, setEditingCategory] = useState<GroupCategory>("memory_card");
  const [search, setSearch] = useState("");
  const [nameSort, setNameSort] = useState<SortDirection>("asc");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const resetCreateForm = () => {
    setName("");
    setCreateCategory("memory_card");
    setCreateScheduleMode(defaultScheduleModeForCategory("memory_card"));
    setCreateColor(presetColorForIndex(groups.length));
    setCreateError("");
  };

  const openCreateModal = () => {
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setCreateModalOpen(false);
    setCreateError("");
  };

  const groupedSections = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const matched = keyword
      ? groups.filter((g) => g.name.toLowerCase().includes(keyword))
      : groups;

    return GROUP_CATEGORY_OPTIONS.map((option) => ({
      ...option,
      groups: sortByName(
        matched.filter((group) => group.category === option.value),
        nameSort
      ),
    })).filter((section) => section.groups.length > 0);
  }, [groups, search, nameSort]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await groupApi.create(
        name.trim(),
        createScheduleMode,
        createColor,
        createCategory
      );
      await refreshGroups();
      setCreateModalOpen(false);
      resetCreateForm();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "创建失败";
      setCreateError(typeof detail === "string" ? detail : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) return;
    await groupApi.update(id, {
      name: editingName.trim(),
      memory_mode: editingScheduleMode,
      color: editingColor,
      category: editingCategory,
    });
    setEditingId(null);
    await refreshGroups();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("删除分组会同时删除组内所有卡片、单词和事项，确定继续？")) return;
    await groupApi.remove(id);
    await refreshGroups();
  };

  useEffect(() => {
    const handler = () => refreshGroups();
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [refreshGroups]);

  const createCategoryMeta =
    GROUP_CATEGORY_OPTIONS.find((item) => item.value === createCategory) ??
    GROUP_CATEGORY_OPTIONS[0];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">分组管理</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            按卡片类别分组展示，创建时可选择适用的类别
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          添加分组
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="按名称搜索分组..." />
        <button
          type="button"
          onClick={() => setNameSort(toggleSortDirection(nameSort))}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/60"
        >
          名称排序 {nameSort === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {groupedSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500">
          {search.trim()
            ? "没有匹配的分组"
            : "还没有分组，点击右上角「添加分组」创建"}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSections.map((section) => (
            <section key={section.value}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {section.label}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {section.groups.length}
                </span>
              </div>
              <ul className="space-y-2">
                {section.groups.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {editingId === g.id ? (
                      <div className="space-y-3">
                        <input
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
                            分组类别
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {GROUP_CATEGORY_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setEditingCategory(option.value);
                                  setEditingScheduleMode((current) => {
                                    if (option.value === editingCategory) return current;
                                    return defaultScheduleModeForCategory(option.value);
                                  });
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                  editingCategory === option.value
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <ScheduleModePicker
                          category={editingCategory}
                          value={editingScheduleMode}
                          onChange={setEditingScheduleMode}
                        />
                        <GroupColorPicker value={editingColor} onChange={setEditingColor} />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSaveEdit(g.id)}
                            className="text-green-600 hover:underline"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-slate-400 hover:underline dark:text-slate-500"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <GroupTag groupId={g.id} />
                          <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            {scheduleLabelForGroupId(g.id)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <IconButton
                            title="编辑"
                            onClick={() => {
                              setEditingId(g.id);
                              setEditingName(g.name);
                              setEditingScheduleMode(
                                scheduleModeForGroup(g.category, g.memory_mode)
                              );
                              setEditingColor(g.color);
                              setEditingCategory(g.category);
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
            </section>
          ))}
        </div>
      )}

      {createModalOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
          onClick={closeCreateModal}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
          >
            <h2 className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">
              添加分组
            </h2>
            <p className="mb-4 text-sm text-slate-400 dark:text-slate-500">
              选择分组类别并填写名称
            </p>

            {createError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {createError}
              </p>
            )}

            <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组类别
            </label>
            <div className="mb-4 flex flex-wrap gap-2">
              {GROUP_CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setCreateCategory(option.value);
                    setCreateScheduleMode((current) => {
                      if (option.value === createCategory) return current;
                      return defaultScheduleModeForCategory(option.value);
                    });
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    createCategory === option.value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组名称
            </label>
            <input
              autoFocus
              className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`新建${createCategoryMeta.label}分组名称`}
              required
            />

            <GroupColorPicker value={createColor} onChange={setCreateColor} />

            <div className="mt-4">
              <ScheduleModePicker
                category={createCategory}
                value={createScheduleMode}
                onChange={setCreateScheduleMode}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "创建中..." : "添加"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
