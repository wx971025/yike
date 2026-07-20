import {
  GROUP_COLOR_PRESETS,
  normalizeGroupColor,
} from "../utils/groupColor";

interface GroupColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function GroupColorPicker({ value, onChange }: GroupColorPickerProps) {
  const normalized = normalizeGroupColor(value);
  const isCustomColor = !GROUP_COLOR_PRESETS.some(
    (color) => color.toUpperCase() === normalized
  );

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
        标签颜色
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {GROUP_COLOR_PRESETS.map((color) => {
          const selected = normalized === color.toUpperCase();
          return (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`选择颜色 ${color}`}
              onClick={() => onChange(color)}
              className={`h-7 w-7 rounded-full border-2 transition ${
                selected
                  ? "border-slate-800 dark:border-white scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          );
        })}
        <label
          title="自定义颜色"
          aria-label="自定义颜色"
          className={`relative ml-1 h-7 w-7 shrink-0 cursor-pointer rounded-full border-2 transition hover:scale-105 ${
            isCustomColor
              ? "border-slate-800 dark:border-white scale-110"
              : "border-slate-200 dark:border-slate-600"
          }`}
          style={{
            background:
              "conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
          }}
        >
          <span className="sr-only">自定义颜色</span>
          <input
            type="color"
            value={normalized}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
