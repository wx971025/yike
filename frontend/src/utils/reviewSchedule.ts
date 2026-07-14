import {
  getReviewDays,
  getTotalStages,
  stageDayLabel,
  type MemoryMode,
  type ReviewSchedulable,
} from "../types";

export type StageStatus = "completed" | "current" | "overdue" | "upcoming" | "mastered";

export interface ReviewStage {
  index: number;
  day: number;
  dueDate: string;
  status: StageStatus;
  label: string;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from).getTime();
  const b = parseLocalDate(to).getTime();
  return Math.round((b - a) / 86400000);
}

export function getNextReviewDate(
  item: Pick<ReviewSchedulable, "learned_at" | "stage_index" | "status">,
  memoryMode?: MemoryMode | string | null
): string | null {
  if (item.status === "mastered") return null;
  const days = getReviewDays(memoryMode);
  const day = days[Math.min(item.stage_index, days.length - 1)];
  return addDays(item.learned_at, day);
}

export type PlanCardStatus = "reviewed_today" | "due_today" | "upcoming";

const planCardStatusMeta: Record<
  PlanCardStatus,
  { label: string; className: string }
> = {
  reviewed_today: {
    label: "今日已复习",
    className: "bg-green-100 text-green-700",
  },
  due_today: {
    label: "今日未复习",
    className: "bg-red-100 text-red-700",
  },
  upcoming: {
    label: "待复习",
    className: "bg-slate-100 text-slate-500",
  },
};

export function getPlanCardStatus(
  item: Pick<ReviewSchedulable, "learned_at" | "stage_index" | "status" | "last_reviewed_at">,
  today = todayStr(),
  memoryMode?: MemoryMode | string | null
): PlanCardStatus {
  if (item.last_reviewed_at === today) return "reviewed_today";
  const dueDate = getNextReviewDate(item, memoryMode);
  if (dueDate && dueDate <= today) return "due_today";
  return "upcoming";
}

export function getPlanCardStatusMeta(
  item: Pick<ReviewSchedulable, "learned_at" | "stage_index" | "status" | "last_reviewed_at">,
  today = todayStr(),
  memoryMode?: MemoryMode | string | null
) {
  return planCardStatusMeta[getPlanCardStatus(item, today, memoryMode)];
}

export function buildReviewStages(
  item: Pick<ReviewSchedulable, "learned_at" | "stage_index" | "status">,
  today = todayStr(),
  memoryMode?: MemoryMode | string | null
): ReviewStage[] {
  const reviewDays = getReviewDays(memoryMode);
  return reviewDays.map((day, index) => {
    const dueDate = addDays(item.learned_at, day);
    let status: StageStatus;

    if (item.status === "mastered") {
      status = "mastered";
    } else if (index < item.stage_index) {
      status = "completed";
    } else if (index === item.stage_index) {
      status = daysBetween(dueDate, today) > 0 ? "overdue" : "current";
    } else {
      status = "upcoming";
    }

    return {
      index,
      day,
      dueDate,
      status,
      label: stageDayLabel(memoryMode, day),
    };
  });
}

export function todayStr(): string {
  return formatLocalDate(new Date());
}

export function learnedAtForStage(
  stageIndex: number,
  memoryMode?: MemoryMode | string | null,
  today = todayStr()
): string {
  const days = getReviewDays(memoryMode);
  const offset = days[Math.min(stageIndex, days.length - 1)] ?? 0;
  const d = parseLocalDate(today);
  d.setDate(d.getDate() - offset);
  return formatLocalDate(d);
}

/** 模拟艾宾浩斯记忆留存率：未复习时按指数衰减，复习后回升 */
export function retentionAtDay(day: number, reviewDays: number[]): number {
  if (day <= 0) return 100;

  let retention = 100;
  let lastReview = 0;

  for (const rd of reviewDays) {
    if (day <= rd) {
      const elapsed = day - lastReview;
      const span = rd - lastReview || 1;
      const decay = Math.exp(-3.5 * (elapsed / span));
      return Math.max(8, retention * decay);
    }
    retention = Math.max(8, retention * Math.exp(-3.5));
    retention = Math.min(100, retention + 58);
    lastReview = rd;
  }

  const elapsed = day - lastReview;
  const lastDay = reviewDays[reviewDays.length - 1];
  const span = Math.max(lastDay - lastReview, 1);
  return Math.max(8, retention * Math.exp(-2.5 * (elapsed / span)));
}

export function curvePoints(maxDay: number, reviewDays: number[]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let d = 0; d <= maxDay; d++) {
    points.push({ x: d, y: retentionAtDay(d, reviewDays) });
  }
  return points;
}

export { getReviewDays, getTotalStages };
