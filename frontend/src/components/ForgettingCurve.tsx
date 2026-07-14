import type { Item } from "../types";
import { useGroups } from "../context/GroupContext";
import {
  buildReviewStages,
  curvePoints,
  getReviewDays,
  getTotalStages,
  retentionAtDay,
  type ReviewStage,
} from "../utils/reviewSchedule";

const statusStyles: Record<
  ReviewStage["status"],
  { dot: string; ring: string; label: string }
> = {
  completed: {
    dot: "bg-green-500",
    ring: "border-green-200 bg-green-50",
    label: "已完成",
  },
  current: {
    dot: "bg-blue-500",
    ring: "border-blue-200 bg-blue-50",
    label: "待复习",
  },
  overdue: {
    dot: "bg-red-500",
    ring: "border-red-200 bg-red-50",
    label: "已逾期",
  },
  upcoming: {
    dot: "bg-slate-300",
    ring: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60",
    label: "未到期",
  },
  mastered: {
    dot: "bg-emerald-500",
    ring: "border-emerald-200 bg-emerald-50",
    label: "已掌握",
  },
};

const HIDDEN_AXIS_LABEL_DAYS = new Set([3, 7]);

interface ForgettingCurveProps {
  item: Item;
}

export default function ForgettingCurve({ item }: ForgettingCurveProps) {
  const { groups, memoryModeForGroupId, memoryModeLabelForGroupId } = useGroups();
  const memoryMode = memoryModeForGroupId(item.group_id);
  const groupName =
    item.group_id == null
      ? "无分组"
      : groups.find((g) => g.id === item.group_id)?.name ?? "未知分组";

  const reviewDays = getReviewDays(memoryMode);
  const totalStages = getTotalStages(memoryMode);
  const stages = buildReviewStages(item, undefined, memoryMode);
  const maxDay = reviewDays[reviewDays.length - 1];
  const completedDays = stages
    .filter((s) => s.status === "completed" || s.status === "mastered")
    .map((s) => s.day);
  const points = curvePoints(maxDay, completedDays);

  const width = 560;
  const height = 260;
  const labelRowGap = 14;
  const maxLabelRows = 3;
  const pad = { top: 16, right: 16, bottom: 24 + maxLabelRows * labelRowGap, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const toX = (day: number) => pad.left + (day / maxDay) * chartW;
  const toY = (retention: number) =>
    pad.top + chartH - (retention / 100) * chartH;

  const labelBaseY = height - pad.bottom + 16;
  const minLabelGap = 30;

  const axisLabels = stages
    .filter((stage) => stage.day > 0 && !HIDDEN_AXIS_LABEL_DAYS.has(stage.day))
    .map((stage) => ({ day: stage.day, x: toX(stage.day) }))
    .sort((a, b) => a.x - b.x);

  type PlacedLabel = { day: number; x: number; row: number };

  const fitsRow = (x: number, row: number, placed: PlacedLabel[]) =>
    placed
      .filter((p) => p.row === row)
      .every((p) => Math.abs(x - p.x) >= minLabelGap);

  const minDistOnRow = (x: number, row: number, placed: PlacedLabel[]) => {
    const sameRow = placed.filter((p) => p.row === row);
    if (sameRow.length === 0) return Infinity;
    return Math.min(...sameRow.map((p) => Math.abs(x - p.x)));
  };

  const placedLabels: PlacedLabel[] = [];
  for (const label of axisLabels) {
    let row = 0;
    for (let r = 0; r < maxLabelRows; r++) {
      if (fitsRow(label.x, r, placedLabels)) {
        row = r;
        break;
      }
      if (r === maxLabelRows - 1) {
        let bestRow = 0;
        let bestDist = -1;
        for (let candidate = 0; candidate < maxLabelRows; candidate++) {
          const dist = minDistOnRow(label.x, candidate, placedLabels);
          if (dist > bestDist) {
            bestDist = dist;
            bestRow = candidate;
          }
        }
        row = bestRow;
      }
    }
    placedLabels.push({ ...label, row });
  }

  const labelByDay = new Map(placedLabels.map((l) => [l.day, l.row]));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`)
    .join(" ");

  const areaD = `${pathD} L ${toX(maxDay).toFixed(1)} ${toY(0).toFixed(1)} L ${toX(0).toFixed(1)} ${toY(0).toFixed(1)} Z`;

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="font-medium text-slate-800 dark:text-slate-100">{groupName}</div>
        <div className="mt-0.5">
          <span className="text-slate-600 dark:text-slate-300">{item.title}</span>
          {item.description && (
            <span className="text-slate-400 dark:text-slate-500"> — {item.description}</span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {memoryModeLabelForGroupId(item.group_id)} · 学习日 {item.learned_at} · 当前第{" "}
          {Math.min(item.stage_index + 1, totalStages)}/{totalStages} 轮
        </div>
      </div>

      <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">记忆留存曲线</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[320px]">
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                y1={toY(v)}
                x2={width - pad.right}
                y2={toY(v)}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text x={4} y={toY(v) + 4} fontSize="10" fill="#94a3b8">
                {v}%
              </text>
            </g>
          ))}

          <path d={areaD} fill="url(#curveFill)" />
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" />

          <circle cx={toX(0)} cy={toY(100)} r="4" fill="#16a34a" />
          <text x={toX(0)} y={toY(100) - 8} fontSize="10" fill="#16a34a" textAnchor="middle">
            学习
          </text>

          {stages.map((stage) => {
            const x = toX(stage.day);
            const y = toY(retentionAtDay(stage.day, completedDays));
            const color =
              stage.status === "completed" || stage.status === "mastered"
                ? "#16a34a"
                : stage.status === "current"
                  ? "#2563eb"
                  : stage.status === "overdue"
                    ? "#dc2626"
                    : "#cbd5e1";
            return (
              <g key={stage.index}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={height - pad.bottom}
                  stroke={color}
                  strokeDasharray="3 3"
                  opacity="0.35"
                />
                <circle cx={x} cy={y} r="5" fill={color} stroke="white" strokeWidth="2" />
                {stage.day > 0 && !HIDDEN_AXIS_LABEL_DAYS.has(stage.day) && (
                  <text
                    x={x}
                    y={labelBaseY + (labelByDay.get(stage.day) ?? 0) * labelRowGap}
                    fontSize="10"
                    fill="#64748b"
                    textAnchor="middle"
                  >
                    {`${stage.day}天`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-5 text-sm font-medium text-slate-700 dark:text-slate-200">复习节点</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {stages.map((stage) => {
          const style = statusStyles[stage.status];
          return (
            <div
              key={stage.index}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${style.ring}`}
            >
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  第 {stage.index + 1} 轮 · {stage.label}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500">{stage.dueDate}</div>
              </div>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{style.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
