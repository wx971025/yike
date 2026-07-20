import { useCallback, useEffect, useMemo, useState } from "react";
import { itemApi, type ItemPayload } from "../api";
import BulkGroupEditModal from "../components/BulkGroupEditModal";
import GroupTag from "../components/GroupTag";
import ItemActionsMenu from "../components/ItemActionsMenu";
import PageGroupFilter from "../components/PageGroupFilter";
import PlanMultiSelectBar, {
  MultiSelectToggleButton,
  SelectCheckbox,
} from "../components/PlanMultiSelectBar";
import {
  IconButton,
  JoinPlanIcon,
  LeavePlanIcon,
} from "../components/ItemIcons";
import SearchBox from "../components/SearchBox";
import SortableHeader from "../components/SortableHeader";
import { useGroups } from "../context/GroupContext";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { getReviewStageOptions, type Item } from "../types";
import { filterGroupsByCategory } from "../utils/groupCategory";
import { ensureGroupsBeforeCreate } from "../utils/groupRequired";
import { isGroupFilterActive } from "../utils/groupFilter";
import { learnedAtForStage } from "../utils/reviewSchedule";
import {
  sortByCreatedAt,
  sortByTitle,
  toggleSortDirection,
  type SortDirection,
} from "../utils/sort";

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

const emptyForm: ItemPayload = {
  title: "",
  description: "",
  group_id: 0,
  stage_index: 0,
};

export default function ItemsPage() {
  const { groups, memoryModeForGroupId, totalStagesForGroupId } = useGroups();
  const memoryCardGroups = useMemo(
    () => filterGroupsByCategory(groups, "memory_card"),
    [groups]
  );
  const [groupFilterIds, setGroupFilterIds] = useState<Set<number>>(new Set());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemPayload>(emptyForm);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"title" | "created_at">("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkGroupModalOpen, setBulkGroupModalOpen] = useState(false);
  const [bulkGroupError, setBulkGroupError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const {
    selectMode,
    selectedIds,
    selectedCount,
    exitSelectMode,
    toggleSelectMode,
    toggleItem,
    toggleAll,
    isAllSelected,
    isPartiallySelected,
  } = useMultiSelect();

  const [formError, setFormError] = useState("");

  const formMemoryMode = memoryModeForGroupId(form.group_id);
  const formStageOptions = useMemo(
    () => getReviewStageOptions(formMemoryMode),
    [formMemoryMode]
  );


  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await itemApi.list(
        groupFilterIds,
        null,
        debouncedSearch || undefined
      );
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, [groupFilterIds, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleSortToggle = (field: "title" | "created_at") => {
    if (sortField === field) {
      setSortDirection(toggleSortDirection(sortDirection));
    } else {
      setSortField(field);
      setSortDirection(field === "created_at" ? "desc" : "asc");
    }
  };

  const sortedItems = useMemo(() => {
    if (sortField === "created_at") {
      return sortByCreatedAt(items, sortDirection);
    }
    return sortByTitle(items, sortDirection);
  }, [items, sortField, sortDirection]);

  const visibleIds = useMemo(
    () => sortedItems.map((item) => item.id),
    [sortedItems]
  );

  const handleToggleSelectMode = () => {
    setOpenMenuId(null);
    toggleSelectMode();
  };

  const handleJoinSelected = async () => {
    if (selectedCount === 0) return;
    setBulkLoading(true);
    try {
      const targets = sortedItems.filter(
        (item) => selectedIds.has(item.id) && !item.in_plan
      );
      for (const item of targets) {
        await itemApi.joinPlan(item.id);
      }
      if (targets.length > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveSelected = async () => {
    if (selectedCount === 0) return;
    setBulkLoading(true);
    try {
      const targets = sortedItems.filter(
        (item) => selectedIds.has(item.id) && item.in_plan
      );
      for (const item of targets) {
        await itemApi.leavePlan(item.id);
      }
      if (targets.length > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    if (!confirm(`确定删除选中的 ${selectedCount} 张卡片？`)) return;
    setBulkLoading(true);
    try {
      const targets = sortedItems.filter((item) => selectedIds.has(item.id));
      for (const item of targets) {
        await itemApi.remove(item.id);
      }
      if (targets.length > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleEditGroupSelected = () => {
    if (selectedCount === 0) return;
    if (memoryCardGroups.length === 0) {
      const check = ensureGroupsBeforeCreate(groups, "memory_card");
      if (!check.ok) {
        window.alert(check.message);
      }
      return;
    }
    setBulkGroupError("");
    setBulkGroupModalOpen(true);
  };

  const handleConfirmBulkGroup = async (groupId: number) => {
    const targets = sortedItems.filter((item) => selectedIds.has(item.id));
    if (targets.length === 0) return;

    setBulkLoading(true);
    setBulkGroupError("");

    const failed: string[] = [];
    let updated = 0;

    try {
      for (const item of targets) {
        if (item.group_id === groupId) continue;
        try {
          await itemApi.update(item.id, { group_id: groupId });
          updated += 1;
        } catch (err: unknown) {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail ?? "移动失败";
          failed.push(
            `${item.title}：${typeof detail === "string" ? detail : "移动失败"}`
          );
        }
      }

      if (updated > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
        setBulkGroupModalOpen(false);
        exitSelectMode();
      } else if (failed.length > 0) {
        setBulkGroupError(
          failed.length === 1
            ? failed[0]
            : `${failed.slice(0, 2).join("；")}${
                failed.length > 2 ? ` 等 ${failed.length} 项失败` : ""
              }`
        );
      } else {
        setBulkGroupModalOpen(false);
        exitSelectMode();
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const openCreate = () => {
    const check = ensureGroupsBeforeCreate(groups, "memory_card", groupFilterIds);
    if (!check.ok) {
      window.alert(check.message);
      return;
    }
    setEditingId(null);
    setFormError("");
    setForm({ ...emptyForm, group_id: check.groupId });
    setModalOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingId(item.id);
    setFormError("");
    setForm({
      title: item.title,
      description: item.description,
      group_id: item.group_id ?? memoryCardGroups[0]?.id ?? 0,
      learned_at: item.learned_at,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.group_id) {
      setFormError("请选择分组");
      return;
    }
    try {
      if (editingId == null) {
        await itemApi.create({
          title: form.title,
          description: form.description,
          group_id: form.group_id,
          stage_index: form.stage_index ?? 0,
        });
      } else {
        await itemApi.update(editingId, form);
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "保存失败";
      setFormError(typeof detail === "string" ? detail : "保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该卡片？")) return;
    await itemApi.remove(id);
    await load();
  };

  const handleJoinPlan = async (id: number) => {
    await itemApi.joinPlan(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeavePlan = async (id: number) => {
    await itemApi.leavePlan(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinAll = async () => {
    setBulkLoading(true);
    try {
      const res = await itemApi.joinPlanAll(
        groupFilterIds,
        debouncedSearch || undefined
      );
      if (res.data.count > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveAll = async () => {
    setBulkLoading(true);
    try {
      const res = await itemApi.leavePlanAll(
        groupFilterIds,
        debouncedSearch || undefined
      );
      if (res.data.count > 0) {
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const inPlanCount = items.filter((it) => it.in_plan).length;
  const notInPlanCount = items.length - inPlanCount;
  const emptyMessage = debouncedSearch
    ? "没有匹配的卡片"
    : isGroupFilterActive(groupFilterIds)
      ? "当前筛选条件下没有卡片"
      : "还没有学习卡片，点击右上角添加卡片开始录入";

  return (
    <div className={selectMode ? "pb-24" : undefined}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">记忆卡片</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            新建记忆卡片后需加入复习计划才会收到提醒，点击日历图标加入计划
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            添加卡片
          </button>
        </div>
      </div>

      <div className="mb-4">
        <SearchBox value={search} onChange={setSearch} placeholder="按标题搜索卡片..." />
      </div>

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              总共 {items.length} 条，{inPlanCount} 条加入计划
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <MultiSelectToggleButton
                active={selectMode}
                onClick={handleToggleSelectMode}
              />
              <button
                onClick={handleJoinAll}
                disabled={bulkLoading || notInPlanCount === 0 || selectMode}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {bulkLoading ? "处理中..." : "全部加入计划"}
              </button>
              <button
                onClick={handleLeaveAll}
                disabled={bulkLoading || inPlanCount === 0 || selectMode}
                className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-600 transition hover:bg-orange-100 disabled:opacity-50"
              >
                {bulkLoading ? "处理中..." : "全部移出计划"}
              </button>
              <PageGroupFilter
                selectedIds={groupFilterIds}
                onChange={setGroupFilterIds}
                category="memory_card"
              />
            </div>
          </div>
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-16 text-center text-slate-400 dark:text-slate-500">
              {emptyMessage}
            </div>
          ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-slate-500 dark:text-slate-400">
              <tr>
                {selectMode && (
                  <th className="w-12 px-4 py-3">
                    <SelectCheckbox
                      checked={isAllSelected(visibleIds)}
                      indeterminate={isPartiallySelected(visibleIds)}
                      onChange={() => toggleAll(visibleIds)}
                      ariaLabel="全选当前列表"
                    />
                  </th>
                )}
                <th className="w-14 px-4 py-3">序号</th>
                <SortableHeader
                  label="标题"
                  direction={sortDirection}
                  active={sortField === "title"}
                  onToggle={() => handleSortToggle("title")}
                />
                <th className="px-4 py-3">分组</th>
                <SortableHeader
                  label="添加时间"
                  direction={sortDirection}
                  active={sortField === "created_at"}
                  onToggle={() => handleSortToggle("created_at")}
                />
                <th className="px-4 py-3">进度</th>
                <th className="px-4 py-3">状态</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-t border-slate-100 dark:border-slate-800 ${
                    selectMode && selectedIds.has(item.id)
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : ""
                  }`}
                >
                  {selectMode && (
                    <td className="px-4 py-3">
                      <SelectCheckbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        ariaLabel={`选择 ${item.title}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 tabular-nums text-slate-400 dark:text-slate-500">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    <GroupTag groupId={item.group_id} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                    {formatCreatedAt(item.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    第 {item.stage_index + 1}/{totalStagesForGroupId(item.group_id)} 轮
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "mastered" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        已完成
                      </span>
                    ) : item.in_plan ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        计划中
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                        未加入计划
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {!selectMode && (
                        <>
                          {item.in_plan ? (
                            <IconButton
                              title="移出复习计划"
                              onClick={() => handleLeavePlan(item.id)}
                              className="text-orange-600 hover:bg-orange-50"
                            >
                              <LeavePlanIcon />
                            </IconButton>
                          ) : (
                            <IconButton
                              title="加入复习计划"
                              onClick={() => handleJoinPlan(item.id)}
                              className="text-emerald-600 hover:bg-emerald-50"
                            >
                              <JoinPlanIcon />
                            </IconButton>
                          )}
                        </>
                      )}
                      <ItemActionsMenu
                        open={openMenuId === item.id}
                        onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}
                        onEdit={() => openEdit(item)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}

      <PlanMultiSelectBar
        visible={selectMode}
        selectedCount={selectedCount}
        loading={bulkLoading}
        onJoin={handleJoinSelected}
        onLeave={handleLeaveSelected}
        onEditGroup={handleEditGroupSelected}
        onDelete={handleDeleteSelected}
        onCancel={exitSelectMode}
      />

      <BulkGroupEditModal
        open={bulkGroupModalOpen}
        selectedCount={selectedCount}
        groups={memoryCardGroups}
        loading={bulkLoading}
        error={bulkGroupError}
        onClose={() => {
          if (bulkLoading) return;
          setBulkGroupModalOpen(false);
          setBulkGroupError("");
        }}
        onConfirm={handleConfirmBulkGroup}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
              {editingId == null ? "新建卡片" : "编辑卡片"}
            </h2>

            {formError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              标题
            </label>
            <input
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如 unit1"
              required
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              说明
            </label>
            <textarea
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="这个卡片是什么内容"
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组
            </label>
            <select
              required
              className="mb-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
              value={form.group_id || memoryCardGroups[0]?.id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  group_id: Number(e.target.value),
                  stage_index: 0,
                })
              }
            >
              {memoryCardGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {editingId == null ? (
              <>
                <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  当前复习周期
                </label>
                <div className="mb-1 flex flex-wrap gap-2">
                  {formStageOptions.map((opt) => (
                    <button
                      key={opt.index}
                      type="button"
                      onClick={() => setForm({ ...form, stage_index: opt.index })}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        (form.stage_index ?? 0) === opt.index
                          ? "border-blue-500 bg-blue-50 font-medium text-blue-700"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mb-5 text-xs text-slate-400 dark:text-slate-500">
                  学习日期将自动设为 {learnedAtForStage(form.stage_index ?? 0, formMemoryMode)}
                </p>
              </>
            ) : (
              <>
                <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  学习日期
                </label>
                <input
                  type="date"
                  className="mb-5 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
                  value={form.learned_at}
                  onChange={(e) => setForm({ ...form, learned_at: e.target.value })}
                  required
                />
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
