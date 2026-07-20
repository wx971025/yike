export type RecurrenceValue =
  | "daily"
  | "weekly_1"
  | "weekly_2"
  | "weekly_3"
  | "weekly_4"
  | "weekly_5"
  | "weekly_6"
  | "weekly_7"
  | "weekdays"
  | "weekends"
  | "monthly"
  | "yearly";

export type ReminderMode = RecurrenceValue;

export type ReminderScheduleKind =
  | "daily"
  | "weekly"
  | "weekdays"
  | "weekends"
  | "monthly"
  | "yearly";

export const WEEKLY_DAY_OPTIONS = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 7, label: "日" },
] as const;

export const REMINDER_SCHEDULE_OPTIONS: {
  value: ReminderScheduleKind;
  label: string;
  description: string;
}[] = [
  { value: "daily", label: "每天", description: "每天提醒一次" },
  { value: "weekly", label: "每周", description: "每周固定某一天提醒" },
  { value: "weekdays", label: "工作日", description: "周一至周五提醒" },
  { value: "weekends", label: "周末", description: "周六、周日提醒" },
  { value: "monthly", label: "每月", description: "每月同一天提醒" },
  { value: "yearly", label: "每年", description: "每年同一天提醒" },
];

const LEGACY_RECURRENCE_LABELS: Record<string, string> = {
  weekly: "每周",
  every_2: "每隔 2 天",
  every_3: "每隔 3 天",
  every_4: "每隔 4 天",
  every_5: "每隔 5 天",
  every_6: "每隔 6 天",
};

const RECURRENCE_VALUES = new Set<string>([
  "daily",
  "weekdays",
  "weekends",
  "monthly",
  "yearly",
  ...WEEKLY_DAY_OPTIONS.map((day) => `weekly_${day.value}`),
]);

export function buildWeeklyReminderMode(day: number): RecurrenceValue {
  return `weekly_${day}` as RecurrenceValue;
}

export function parseReminderSchedule(value: string | null | undefined): {
  kind: ReminderScheduleKind;
  weeklyDay: number;
} {
  if (!value || value === "weekly") return { kind: "weekly", weeklyDay: 1 };
  if (value.startsWith("weekly_")) {
    const day = Number(value.split("_")[1]);
    if (day >= 1 && day <= 7) {
      return { kind: "weekly", weeklyDay: day };
    }
  }
  if (
    value === "daily" ||
    value === "weekdays" ||
    value === "weekends" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return { kind: value, weeklyDay: 1 };
  }
  return { kind: "daily", weeklyDay: 1 };
}

export function reminderScheduleToMode(
  kind: ReminderScheduleKind,
  weeklyDay: number
): ReminderMode {
  if (kind === "weekly") {
    return buildWeeklyReminderMode(weeklyDay);
  }
  return kind;
}

export function normalizeReminderMode(mode?: string | null): ReminderMode {
  if (mode === "weekly") {
    return "weekly_1";
  }
  if (mode && RECURRENCE_VALUES.has(mode)) {
    return mode as ReminderMode;
  }
  return "daily";
}

export function recurrenceLabel(value: string | null | undefined): string {
  if (!value) return "不循环";
  if (value.startsWith("weekly_")) {
    const day = Number(value.split("_")[1]);
    const weekday = WEEKLY_DAY_OPTIONS.find((item) => item.value === day)?.label;
    return weekday ? `每周${weekday}` : value;
  }
  const option = REMINDER_SCHEDULE_OPTIONS.find((item) => item.value === value);
  if (option) return option.label;
  return LEGACY_RECURRENCE_LABELS[value] ?? value;
}

export function reminderModeLabel(mode?: string | null): string {
  return recurrenceLabel(mode ?? "daily");
}

/** @deprecated 使用 REMINDER_SCHEDULE_OPTIONS + 周几选择 */
export const RECURRENCE_OPTIONS = REMINDER_SCHEDULE_OPTIONS.map((item) => ({
  value: item.value === "weekly" ? "weekly_1" : item.value,
  label: item.label,
}));
