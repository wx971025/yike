import type { Group, GroupCategory } from "../types";
import { filterGroupsByCategory, groupCategoryLabel } from "./groupCategory";
import { UNGROUPED_GROUP_ID, type GroupFilterSelection } from "./groupFilter";

export function noGroupPrompt(category: GroupCategory): string {
  return `请先创建一个${groupCategoryLabel(category)}分组`;
}

export function resolveDefaultGroupId(
  groups: Group[],
  category: GroupCategory,
  filteredGroupIds?: GroupFilterSelection
): number | null {
  const categoryGroups = filterGroupsByCategory(groups, category);
  if (categoryGroups.length === 0) {
    return null;
  }
  if (filteredGroupIds) {
    const realIds = Array.from(filteredGroupIds).filter(
      (id) => id !== UNGROUPED_GROUP_ID
    );
    if (realIds.length === 1) {
      const matched = categoryGroups.find((group) => group.id === realIds[0]);
      if (matched) return matched.id;
    }
  }
  return categoryGroups[0]?.id ?? null;
}

export function ensureGroupsBeforeCreate(
  groups: Group[],
  category: GroupCategory,
  filteredGroupIds?: GroupFilterSelection
): { ok: true; groupId: number } | { ok: false; message: string } {
  const groupId = resolveDefaultGroupId(groups, category, filteredGroupIds);
  if (groupId == null) {
    return { ok: false, message: noGroupPrompt(category) };
  }
  return { ok: true, groupId };
}
