export const UNGROUPED_GROUP_ID = 0;

export type GroupFilterSelection = Set<number>;

export function isGroupFilterActive(selectedIds: GroupFilterSelection): boolean {
  return selectedIds.size > 0;
}

export function matchesGroupFilter(
  groupId: number | null,
  selectedIds: GroupFilterSelection
): boolean {
  if (selectedIds.size === 0) return true;
  if (groupId == null) return selectedIds.has(UNGROUPED_GROUP_ID);
  return selectedIds.has(groupId);
}

export function toApiGroupIds(selectedIds: GroupFilterSelection): number[] | undefined {
  if (selectedIds.size === 0) return undefined;
  return Array.from(selectedIds);
}

export function groupFilterLabel(
  selectedIds: GroupFilterSelection,
  groups: { id: number; name: string }[]
): string {
  if (selectedIds.size === 0) return "全部分组";
  const names: string[] = [];
  if (selectedIds.has(UNGROUPED_GROUP_ID)) names.push("无分组");
  for (const group of groups) {
    if (selectedIds.has(group.id)) names.push(group.name);
  }
  if (names.length <= 2) return names.join("、");
  return `${names.slice(0, 2).join("、")} 等 ${names.length} 项`;
}

export function toggleGroupFilterId(
  selectedIds: GroupFilterSelection,
  groupId: number
): GroupFilterSelection {
  const next = new Set(selectedIds);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  return next;
}
