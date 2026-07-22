import { useCallback, useEffect, useMemo, useState } from "react";
import { reminderApi, type ReminderPayload } from "../api";
import ItemActionsMenu from "../components/ItemActionsMenu";
import GroupTag from "../components/GroupTag";
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
import ScheduleModePicker from "../components/ScheduleModePicker";
import { useGroups } from "../context/GroupContext";
import { useMultiSelect } from "../hooks/useMultiSelect";
import { type Reminder } from "../types";
import {
  normalizeReminderMode,
  recurrenceLabel,
  type RecurrenceValue,
} from "../utils/reminderSchedule";
import {
  sortByCreatedAt,
  sortByTitle,
  toggleSortDirection,
  type SortDirection,
} from "../utils/sort";
import { filterGroupsByCategory } from "../utils/groupCategory";
import { ensureGroupsBeforeCreate } from "../utils/groupRequired";
import { todayStr } from "../utils/reviewSchedule";

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

const emptyForm: ReminderPayload = {
  title: "",
  remind_date: todayStr(),
  recurring: false,
  recurrence: "daily",
  in_plan: true,
  group_id: 0,
};

export default function RemindersPage() {
  const { groups } = useGroups();
  const reminderGroups = useMemo(
    () => filterGroupsByCategory(groups, "reminder"),
    [groups]
  );
  const [groupFilterIds, setGroupFilterIds] = useState<Set<number>>(new Set());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReminderPayload>(emptyForm);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"title" | "created_at" | "remind_date">(
    "remind_date"
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await reminderApi.list(null, debouncedSearch || undefined, groupFilterIds);
      setReminders(res.data);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [debouncedSearch, groupFilterIds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load({ silent: true });
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleSortToggle = (field: "title" | "created_at" | "remind_date") => {
    if (sortField === field) {
      setSortDirection(toggleSortDirection(sortDirection));
    } else {
      setSortField(field);
      setSortDirection(field === "created_at" ? "desc" : "asc");
    }
  };

  const sortedReminders = useMemo(() => {
    if (sortField === "created_at") {
      return sortByCreatedAt(reminders, sortDirection);
    }
    if (sortField === "remind_date") {
      const sorted = [...reminders].sort((a, b) =>
        a.remind_date.localeCompare(b.remind_date)
      );
      return sortDirection === "desc" ? sorted.reverse() : sorted;
    }
    return sortByTitle(reminders, sortDirection);
  }, [reminders, sortField, sortDirection]);

  const visibleIds = useMemo(
    () => sortedReminders.map((item) => item.id),
    [sortedReminders]
  );

  const inPlanCount = reminders.filter((item) => item.in_plan).length;
  const notInPlanCount = reminders.length - inPlanCount;
  const emptyMessage = debouncedSearch
    ? "没有匹配的事项"
    : "还没有事项，点击右上角添加事项";

  const openCreate = () => {
    const check = ensureGroupsBeforeCreate(groups, "reminder", groupFilterIds);
    if (!check.ok) {
      window.alert(check.message);
      return;
    }
    const defaultGroup = reminderGroups.find((group) => group.id === check.groupId);
    setEditingId(null);
    setFormError("");
    setForm({
      ...emptyForm,
      remind_date: todayStr(),
      group_id: check.groupId,
      recurrence: normalizeReminderMode(defaultGroup?.memory_mode),
    });
    setModalOpen(true);
  };

  const openEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setFormError("");
    setForm({
      title: reminder.title,
      remind_date: reminder.remind_date,
      recurring: Boolean(reminder.recurrence),
      recurrence: normalizeReminderMode(reminder.recurrence),
      in_plan: reminder.in_plan,
      group_id: reminder.group_id ?? reminderGroups[0]?.id ?? 0,
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
      const payload: ReminderPayload = {
        title: form.title,
        remind_date: form.remind_date,
        recurring: form.recurring,
        recurrence: form.recurring ? form.recurrence : null,
        in_plan: form.in_plan ?? true,
        group_id: form.group_id,
      };
      if (editingId == null) {
        await reminderApi.create(payload);
      } else {
        await reminderApi.update(editingId, payload);
      }
      setModalOpen(false);
      await load();
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "保存失败";
      setFormError(typeof detail === "string" ? detail : "保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该事项？")) return;
    await reminderApi.remove(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinPlan = async (id: number) => {
    const res = await reminderApi.joinPlan(id);
    setReminders((prev) =>
      prev.map((item) => (item.id === id ? res.data : item))
    );
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeavePlan = async (id: number) => {
    const res = await reminderApi.leavePlan(id);
    setReminders((prev) =>
      prev.map((item) => (item.id === id ? res.data : item))
    );
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinAll = async () => {
    setBulkLoading(true);
    try {
      await reminderApi.joinPlanAll(debouncedSearch || undefined);
      await load({ silent: true });
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveAll = async () => {
    setBulkLoading(true);
    try {
      await reminderApi.leavePlanAll(debouncedSearch || undefined);
      await load({ silent: true });
      window.dispatchEvent(new CustomEvent("app-data-changed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleJoinSelected = async () => {
    if (selectedCount === 0) return;
    setBulkLoading(true);
    try {
      const targets = sortedReminders.filter(
        (item) => selectedIds.has(item.id) && !item.in_plan
      );
      for (const item of targets) {
        await reminderApi.joinPlan(item.id);
      }
      if (targets.length > 0) {
        await load({ silent: true });
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
      const targets = sortedReminders.filter(
        (item) => selectedIds.has(item.id) && item.in_plan
      );
      for (const item of targets) {
        await reminderApi.leavePlan(item.id);
      }
      if (targets.length > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
      exitSelectMode();
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    if (!confirm(`确定删除选中的 ${selectedCount} 个事项？`)) return;
    setBulkLoading(true);
    try {
      const targets = sortedReminders.filter((item) => selectedIds.has(item.id));
      for (const item of targets) {
        await reminderApi.remove(item.id);
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

  return (
    <div className={selectMode ? "pb-24" : undefined}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">事项卡片</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            设置提醒日期与循环规则，加入计划后会在到期时收到提醒
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          添加事项
        </button>
      </div>

      <div className="mb-4">
        <SearchBox value={search} onChange={setSearch} placeholder="按标题搜索事项..." />
      </div>

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              总共 {reminders.length} 条，{inPlanCount} 条加入计划
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <MultiSelectToggleButton
                active={selectMode}
                onClick={() => {
                  setOpenMenuId(null);
                  toggleSelectMode();
                }}
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
                category="reminder"
              />
            </div>
          </div>

          {reminders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500">
              {emptyMessage}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
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
                    <SortableHeader
                      label="提醒日期"
                      direction={sortDirection}
                      active={sortField === "remind_date"}
                      onToggle={() => handleSortToggle("remind_date")}
                    />
                    <th className="px-4 py-3">循环</th>
                    <SortableHeader
                      label="添加时间"
                      direction={sortDirection}
                      active={sortField === "created_at"}
                      onToggle={() => handleSortToggle("created_at")}
                    />
                    <th className="px-4 py-3">状态</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sortedReminders.map((reminder, index) => (
                    <tr
                      key={reminder.id}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        selectMode && selectedIds.has(reminder.id)
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : ""
                      }`}
                    >
                      {selectMode && (
                        <td className="px-4 py-3">
                          <SelectCheckbox
                            checked={selectedIds.has(reminder.id)}
                            onChange={() => toggleItem(reminder.id)}
                            ariaLabel={`选择 ${reminder.title}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 tabular-nums text-slate-400 dark:text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{reminder.title}</span>
                          <GroupTag groupId={reminder.group_id} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                        {reminder.remind_date}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {recurrenceLabel(reminder.recurrence)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400">
                        {formatCreatedAt(reminder.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {reminder.in_plan ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            计划中
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            未加入计划
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          {!selectMode && (
                            <>
                              {reminder.in_plan ? (
                                <IconButton
                                  title="移出计划"
                                  onClick={() => handleLeavePlan(reminder.id)}
                                  className="text-orange-600 hover:bg-orange-50"
                                >
                                  <LeavePlanIcon />
                                </IconButton>
                              ) : (
                                <IconButton
                                  title="加入计划"
                                  onClick={() => handleJoinPlan(reminder.id)}
                                  className="text-emerald-600 hover:bg-emerald-50"
                                >
                                  <JoinPlanIcon />
                                </IconButton>
                              )}
                            </>
                          )}
                          <ItemActionsMenu
                            open={openMenuId === reminder.id}
                            onOpenChange={(open) =>
                              setOpenMenuId(open ? reminder.id : null)
                            }
                            onEdit={() => openEdit(reminder)}
                            onDelete={() => handleDelete(reminder.id)}
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
        onDelete={handleDeleteSelected}
        onCancel={exitSelectMode}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">
              {editingId == null ? "新建事项" : "编辑事项"}
            </h2>

            {formError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </p>
            )}

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              分组
            </label>
            <select
              required
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
              value={form.group_id || reminderGroups[0]?.id || ""}
              onChange={(e) => {
                const groupId = Number(e.target.value);
                const group = reminderGroups.find((item) => item.id === groupId);
                setForm({
                  ...form,
                  group_id: groupId,
                  recurrence: normalizeReminderMode(group?.memory_mode),
                });
              }}
            >
              {reminderGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              标题
            </label>
            <input
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如：交水电费"
              required
            />

            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              提醒日期
            </label>
            <input
              type="date"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:focus:border-blue-400"
              value={form.remind_date}
              onChange={(e) => setForm({ ...form, remind_date: e.target.value })}
              required
            />

            <label className="mb-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) =>
                  setForm({ ...form, recurring: e.target.checked })
                }
              />
              循环提醒
            </label>

            {form.recurring && (
              <div className="mb-3">
                <ScheduleModePicker
                  category="reminder"
                  value={form.recurrence ?? "daily"}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      recurrence: value as RecurrenceValue,
                    })
                  }
                />
              </div>
            )}

            <label className="mb-5 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.in_plan ?? true}
                onChange={(e) => setForm({ ...form, in_plan: e.target.checked })}
              />
              加入计划
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
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
