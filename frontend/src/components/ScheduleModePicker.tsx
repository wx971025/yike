import { MEMORY_MODES, type MemoryMode } from "../types";

interface ScheduleModePickerProps {
  category: "memory_card" | "word";
  value: string;
  onChange: (value: string) => void;
}

export default function ScheduleModePicker({
  category,
  value,
  onChange,
}: ScheduleModePickerProps) {
  void category;
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
  category: "memory_card" | "word"
): string {
  void category;
  return "ebbinghaus" as MemoryMode;
}
