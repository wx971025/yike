export type RecurrenceValue =
  | "daily"
  | "weekly"
  | "monthly"
  | "every_2"
  | "every_3"
  | "every_4"
  | "every_5"
  | "every_6"
  | "weekends"
  | "weekdays";

export const RECURRENCE_OPTIONS: { value: RecurrenceValue; label: string }[] = [
  { value: "daily", label: "每日" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "every_2", label: "每隔 2 天" },
  { value: "every_3", label: "每隔 3 天" },
  { value: "every_4", label: "每隔 4 天" },
  { value: "every_5", label: "每隔 5 天" },
  { value: "every_6", label: "每隔 6 天" },
  { value: "weekends", label: "周末" },
  { value: "weekdays", label: "工作日" },
];

export function recurrenceLabel(value: string | null | undefined): string {
  if (!value) return "不循环";
  return RECURRENCE_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}
