import type { Group, GroupCategory } from "../types";

export const GROUP_CATEGORY_OPTIONS: {
  value: GroupCategory;
  label: string;
  description: string;
}[] = [
  {
    value: "memory_card",
    label: "记忆卡片",
    description: "用于归类学习卡片",
  },
  {
    value: "word",
    label: "单词卡片",
    description: "用于归类单词",
  },
  {
    value: "reminder",
    label: "事项卡片",
    description: "用于归类提醒事项",
  },
];

export function groupCategoryLabel(category: GroupCategory | string): string {
  return (
    GROUP_CATEGORY_OPTIONS.find((item) => item.value === category)?.label ??
    category
  );
}

export function filterGroupsByCategory(
  groups: Group[],
  category?: GroupCategory | GroupCategory[]
): Group[] {
  if (!category) return groups;
  const categories = Array.isArray(category) ? category : [category];
  return groups.filter((group) => categories.includes(group.category));
}
