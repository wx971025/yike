import type { ReviewSchedulable } from "../types";
import { getNextReviewDate } from "./reviewSchedule";

export type SortDirection = "asc" | "desc";

export function sortByWord<T extends { word: string }>(
  items: T[],
  direction: SortDirection
): T[] {
  return [...items].sort((a, b) =>
    direction === "asc"
      ? a.word.localeCompare(b.word, "en")
      : b.word.localeCompare(a.word, "en")
  );
}

export function sortByTitle<T extends { title: string }>(
  items: T[],
  direction: SortDirection
): T[] {
  return [...items].sort((a, b) =>
    direction === "asc"
      ? a.title.localeCompare(b.title, "zh-CN")
      : b.title.localeCompare(a.title, "zh-CN")
  );
}

export function sortByName<T extends { name: string }>(
  items: T[],
  direction: SortDirection
): T[] {
  return [...items].sort((a, b) =>
    direction === "asc"
      ? a.name.localeCompare(b.name, "zh-CN")
      : b.name.localeCompare(a.name, "zh-CN")
  );
}

export function sortByCreatedAt<T extends { created_at: string }>(
  items: T[],
  direction: SortDirection
): T[] {
  return [...items].sort((a, b) => {
    const diff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

export function sortByNextReviewDate<T extends ReviewSchedulable & { group_id?: number | null }>(
  items: T[],
  direction: SortDirection,
  memoryModeForItem?: (item: T) => string | null | undefined
): T[] {
  return [...items].sort((a, b) => {
    const aDate = getNextReviewDate(a, memoryModeForItem?.(a));
    const bDate = getNextReviewDate(b, memoryModeForItem?.(b));
    if (aDate == null && bDate == null) return 0;
    if (aDate == null) return 1;
    if (bDate == null) return -1;
    const diff = aDate.localeCompare(bDate);
    return direction === "asc" ? diff : -diff;
  });
}

export function toggleSortDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}
