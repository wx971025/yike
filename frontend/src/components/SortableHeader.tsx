import type { SortDirection } from "../utils/sort";

interface SortableHeaderProps {
  label: string;
  direction: SortDirection;
  onToggle: () => void;
  active?: boolean;
  className?: string;
}

export default function SortableHeader({
  label,
  direction,
  onToggle,
  active = true,
  className = "",
}: SortableHeaderProps) {
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400 transition hover:text-slate-800 dark:text-slate-100"
      >
        {label}
        {active && (
          <span className="text-xs text-blue-600">
            {direction === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}
