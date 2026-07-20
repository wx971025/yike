import { useEffect, useMemo, useRef, useState } from "react";
import { useGroups } from "../context/GroupContext";
import type { GroupCategory } from "../types";
import { filterGroupsByCategory } from "../utils/groupCategory";
import {
  groupFilterLabel,
  toggleGroupFilterId,
  type GroupFilterSelection,
} from "../utils/groupFilter";

interface GroupMultiFilterProps {
  selectedIds: GroupFilterSelection;
  onChange: (ids: GroupFilterSelection) => void;
  category?: GroupCategory | GroupCategory[];
}

export default function GroupMultiFilter({
  selectedIds,
  onChange,
  category,
}: GroupMultiFilterProps) {
  const { groups } = useGroups();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleGroups = useMemo(
    () => filterGroupsByCategory(groups, category),
    [groups, category]
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = (groupId: number) => {
    onChange(toggleGroupFilterId(selectedIds, groupId));
  };

  const clearAll = () => onChange(new Set());

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <span className="text-slate-500 dark:text-slate-400">分组筛选</span>
        <span className="max-w-[10rem] truncate font-medium">
          {groupFilterLabel(selectedIds, visibleGroups)}
        </span>
        <span className="text-xs text-slate-400" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={selectedIds.size === 0}
              onChange={clearAll}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
            />
            <span>全部分组</span>
          </label>
          {visibleGroups.map((group) => (
            <label
              key={group.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(group.id)}
                onChange={() => toggle(group.id)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
              />
              <span className="truncate">{group.name}</span>
            </label>
          ))}
          {visibleGroups.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-400 dark:text-slate-500">
              暂无该类分组
            </p>
          )}
        </div>
      )}
    </div>
  );
}
