import { MEMORY_MODES, type MemoryMode } from "../types";
import {
  REMINDER_SCHEDULE_OPTIONS,
  WEEKLY_DAY_OPTIONS,
  normalizeReminderMode,
  parseReminderSchedule,
  reminderScheduleToMode,
  type ReminderScheduleKind,
} from "../utils/reminderSchedule";

interface ScheduleModePickerProps {
  category: "memory_card" | "word" | "reminder";
  value: string;
  onChange: (value: string) => void;
}

export default function ScheduleModePicker({
  category,
  value,
  onChange,
}: ScheduleModePickerProps) {
  if (category === "reminder") {
    const normalized = normalizeReminderMode(value);
    const { kind, weeklyDay } = parseReminderSchedule(normalized);

    const selectKind = (nextKind: ReminderScheduleKind) => {
      onChange(reminderScheduleToMode(nextKind, weeklyDay));
    };

    const selectWeeklyDay = (day: number) => {
      onChange(reminderScheduleToMode("weekly", day));
    };

    return (
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
          提醒方式
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {REMINDER_SCHEDULE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectKind(option.value)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                kind === option.value
                  ? "border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <div>{option.label}</div>
              <div className="mt-0.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                {option.description}
              </div>
            </button>
          ))}
        </div>

        {kind === "weekly" && (
          <div className="mt-3">
            <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              选择每周提醒日
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKLY_DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => selectWeeklyDay(day.value)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium transition ${
                    weeklyDay === day.value
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                  }`}
                  title={`周${day.label}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
        记忆方式
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {MEMORY_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              value === mode.value
                ? "border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <div>{mode.label}</div>
            <div className="mt-0.5 text-xs font-normal text-slate-400 dark:text-slate-500">
              {mode.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function defaultScheduleModeForCategory(
  category: "memory_card" | "word" | "reminder"
): string {
  return category === "reminder" ? "daily" : ("ebbinghaus" as MemoryMode);
}
