import { useCallback, useState } from "react";

export function useMultiSelect() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      exitSelectMode();
    } else {
      enterSelectMode();
    }
  }, [selectMode, enterSelectMode, exitSelectMode]);

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: number[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const isAllSelected = useCallback(
    (ids: number[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const isPartiallySelected = useCallback(
    (ids: number[]) =>
      ids.some((id) => selectedIds.has(id)) && !ids.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  return {
    selectMode,
    selectedIds,
    selectedCount: selectedIds.size,
    exitSelectMode,
    toggleSelectMode,
    toggleItem,
    toggleAll,
    isAllSelected,
    isPartiallySelected,
  };
}
