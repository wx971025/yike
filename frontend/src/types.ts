export interface User {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  created_at: string;
}

export interface AiConfigStatus {
  ready: boolean;
  active_config_id: number | null;
  active_title: string | null;
  verified: boolean;
}

export interface AiConfigItem {
  id: number;
  title: string;
  base_url: string;
  model: string;
  api_key_masked: string;
  verified: boolean;
  is_active: boolean;
  created_at: string;
}

export type MemoryMode = "ebbinghaus" | "daily_7" | "daily_15" | "daily_30";

export type GroupCategory = "memory_card" | "word" | "reminder";

export interface Group {
  id: number;
  name: string;
  memory_mode: MemoryMode;
  color: string;
  category: GroupCategory;
  created_at: string;
}

export interface Item {
  id: number;
  group_id: number | null;
  title: string;
  description: string;
  learned_at: string;
  stage_index: number;
  stage_status: string;
  status: string;
  in_plan: boolean;
  last_reviewed_at: string | null;
  skipped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewItem extends Item {
  due_date: string;
  overdue_days: number;
}

export interface Reminder {
  id: number;
  group_id: number | null;
  title: string;
  remind_date: string;
  recurrence: string | null;
  in_plan: boolean;
  last_done_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WordExample {
  en: string;
  zh: string;
}

export interface Word {
  id: number;
  group_id: number | null;
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  example_translation: string;
  examples: WordExample[];
  learned_at: string;
  stage_index: number;
  stage_status: string;
  status: string;
  in_plan: boolean;
  last_reviewed_at: string | null;
  skipped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWord extends Word {
  due_date: string;
  overdue_days: number;
}

export interface ConfusableDiffAnalysis {
  sentence_a: string;
  sentence_a_zh: string;
  sentence_b: string;
  sentence_b_zh: string;
  difference: string;
  generated_at?: string;
}

export interface ConfusablePair {
  id: number;
  group_id: number | null;
  source_word_id: number | null;
  word_a: string;
  phonetic_a: string;
  pos_a: string;
  meaning_a: string;
  example_a: string;
  example_a_translation: string;
  word_b: string;
  phonetic_b: string;
  pos_b: string;
  meaning_b: string;
  example_b: string;
  example_b_translation: string;
  diff_analysis: ConfusableDiffAnalysis | null;
  learned_at: string;
  stage_index: number;
  stage_status: string;
  status: string;
  in_plan: boolean;
  last_reviewed_at: string | null;
  skipped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewConfusablePair extends ConfusablePair {
  due_date: string;
  overdue_days: number;
}

export interface ReviewSchedulable {
  learned_at: string;
  stage_index: number;
  status: string;
  last_reviewed_at: string | null;
  in_plan: boolean;
}

export interface CalendarEventItem {
  id: number;
  title: string;
  group_id: number | null;
  stage: number;
  stage_index: number;
  kind: "item" | "word" | "reminder" | "confusable_pair";
}

export interface CalendarDay {
  date: string;
  items: CalendarEventItem[];
}

export interface ReviewedTodayItem {
  id: number;
  title: string;
  group_id: number | null;
  kind: "item" | "word";
  stage: number;
}

export interface ReviewedTodayResponse {
  items: ReviewedTodayItem[];
  total: number;
  item_count: number;
  word_count: number;
}

export interface CalendarResponse {
  events: CalendarDay[];
}

export const INTERVALS = [3, 7, 15, 30, 60, 180];
export const REVIEW_DAYS = [0, ...INTERVALS];
export const TOTAL_STAGES = REVIEW_DAYS.length;

export const MEMORY_MODE_SCHEDULES: Record<MemoryMode, number[]> = {
  ebbinghaus: REVIEW_DAYS,
  daily_7: Array.from({ length: 7 }, (_, i) => i),
  daily_15: Array.from({ length: 15 }, (_, i) => i),
  daily_30: Array.from({ length: 30 }, (_, i) => i),
};

export const MEMORY_MODES: {
  value: MemoryMode;
  label: string;
  description: string;
}[] = [
  {
    value: "ebbinghaus",
    label: "艾宾浩斯 · 间隔复习",
    description: "当天、3/7/15/30/60/180 天后复习，适合长期记忆",
  },
  {
    value: "daily_7",
    label: "连续巩固 · 7 天",
    description: "连续 7 天每日复习，适合短期突击",
  },
  {
    value: "daily_15",
    label: "连续巩固 · 15 天",
    description: "连续 15 天每日复习，适合中期巩固",
  },
  {
    value: "daily_30",
    label: "连续巩固 · 30 天",
    description: "连续 30 天每日复习，适合深度养成习惯",
  },
];

export function normalizeMemoryMode(mode?: string | null): MemoryMode {
  if (mode && mode in MEMORY_MODE_SCHEDULES) {
    return mode as MemoryMode;
  }
  return "ebbinghaus";
}

export function getReviewDays(mode?: string | null): number[] {
  return MEMORY_MODE_SCHEDULES[normalizeMemoryMode(mode)];
}

export function getTotalStages(mode?: string | null): number {
  return getReviewDays(mode).length;
}

export function getLastStageIndex(mode?: string | null): number {
  return Math.max(0, getTotalStages(mode) - 1);
}

export function stageDayLabel(mode: MemoryMode | string | null | undefined, day: number): string {
  const normalized = normalizeMemoryMode(mode);
  if (normalized.startsWith("daily_")) {
    return day === 0 ? "第 1 天" : `第 ${day + 1} 天`;
  }
  return day === 0 ? "当天" : `${day}天后`;
}

export function getReviewStageOptions(mode?: string | null) {
  return getReviewDays(mode).map((day, index) => ({
    index,
    day,
    label: stageDayLabel(mode, day),
  }));
}

export const REVIEW_STAGE_OPTIONS = getReviewStageOptions("ebbinghaus");

export interface SkillCatalog {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Skill extends SkillCatalog {
  content: string;
}
