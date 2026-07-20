const STORAGE_PREFIX = "yike-onboarding-v1";

export function onboardingStorageKey(userId: number): string {
  return `${STORAGE_PREFIX}-${userId}`;
}

export function isOnboardingCompleted(userId: number): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(onboardingStorageKey(userId)) === "1";
}

export function markOnboardingCompleted(userId: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(onboardingStorageKey(userId), "1");
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  path?: string;
  expandCards?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "欢迎使用忆刻",
    description:
      "接下来带你快速了解：如何添加单词、查看复习计划，以及开始今日复习。",
  },
  {
    id: "words-nav",
    title: "进入单词卡片",
    description: "单词都管理在这里。点击侧边栏的「单词卡片」进入单词列表。",
    target: '[data-tour="nav-words"]',
    path: "/words",
    expandCards: true,
  },
  {
    id: "add-word",
    title: "添加单词",
    description:
      "点击右上角「添加单词」，输入单词即可加入你的词库（可自动查词典补全释义）。",
    target: '[data-tour="add-word"]',
    path: "/words",
    expandCards: true,
  },
  {
    id: "plan",
    title: "查看复习计划",
    description:
      "在「计划管理」里可以看到已加入复习计划的单词和卡片，以及下次复习时间。",
    target: '[data-tour="nav-plan"]',
    path: "/plan",
  },
  {
    id: "review",
    title: "开始今日复习",
    description:
      "每天打开「今日复习」，根据释义拼写单词，完成当天到期的复习任务。",
    target: '[data-tour="nav-review"]',
    path: "/",
  },
];
