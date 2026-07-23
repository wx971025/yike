import api from "./client";
import type {
  CalendarResponse,
  ConfusableDiffAnalysis,
  ConfusablePair,
  Group,
  GroupCategory,
  Item,
  ReviewConfusablePair,
  ReviewItem,
  ReviewWord,
  ReviewedTodayResponse,
  Skill,
  SkillCatalog,
  AiConfigItem,
  AiConfigStatus,
  User,
  Word,
} from "../types";
import { toApiGroupIds, type GroupFilterSelection } from "../utils/groupFilter";
import type { WordReviewTrack } from "../utils/wordReviewTrack";

function groupFilterParams(groupIds?: GroupFilterSelection) {
  const ids = groupIds ? toApiGroupIds(groupIds) : undefined;
  return ids && ids.length > 0 ? { group_ids: ids } : {};
}

export const authApi = {
  register: (username: string, password: string) =>
    api.post<{ access_token: string }>("/auth/register", { username, password }),
  login: (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    return api.post<{ access_token: string }>("/auth/login", form);
  },
  me: () => api.get<User>("/auth/me"),
  updateProfile: (payload: { nickname?: string; avatar?: string }) =>
    api.put<User>("/auth/profile", payload),
  getAiConfigStatus: () => api.get<AiConfigStatus>("/auth/ai-config"),
  listAiConfigs: () => api.get<AiConfigItem[]>("/auth/ai-configs"),
  createAiConfig: (payload: {
    title: string;
    base_url: string;
    api_key: string;
    model: string;
  }) => api.post<AiConfigItem>("/auth/ai-configs", payload),
  updateAiConfig: (
    id: number,
    payload: {
      title?: string;
      base_url?: string;
      api_key?: string;
      model?: string;
    }
  ) => api.put<AiConfigItem>(`/auth/ai-configs/${id}`, payload),
  deleteAiConfig: (id: number) => api.delete(`/auth/ai-configs/${id}`),
  activateAiConfig: (id: number) =>
    api.post<AiConfigItem>(`/auth/ai-configs/${id}/activate`),
  revealAiConfigApiKey: (id: number) =>
    api.get<{ api_key: string }>(`/auth/ai-configs/${id}/api-key`),
  testAiConfig: (
    id: number,
    payload?: {
      base_url?: string;
      api_key?: string;
      model?: string;
    }
  ) => api.post<AiConfigItem>(`/auth/ai-configs/${id}/test`, payload ?? {}),
};

export const groupApi = {
  list: (q?: string, category?: GroupCategory) =>
    api.get<Group[]>("/groups", {
      params: {
        ...(q ? { q } : {}),
        ...(category ? { category } : {}),
      },
    }),
  create: (
    name: string,
    memory_mode?: string,
    color?: string,
    category?: GroupCategory
  ) => api.post<Group>("/groups", { name, memory_mode, color, category }),
  update: (
    id: number,
    payload: {
      name?: string;
      memory_mode?: string;
      color?: string;
      category?: GroupCategory;
    }
  ) => api.put<Group>(`/groups/${id}`, payload),
  remove: (id: number) => api.delete(`/groups/${id}`),
};

export interface ItemPayload {
  title: string;
  description: string;
  group_id: number | null;
  learned_at?: string;
  stage_index?: number;
}

export const itemApi = {
  list: (
    groupIds?: GroupFilterSelection,
    inPlan?: boolean | null,
    q?: string
  ) =>
    api.get<Item[]>("/items", {
      params: {
        ...groupFilterParams(groupIds),
        ...(inPlan != null ? { in_plan: inPlan } : {}),
        ...(q ? { q } : {}),
      },
    }),
  create: (payload: ItemPayload) => api.post<Item>("/items", payload),
  update: (id: number, payload: Partial<ItemPayload>) =>
    api.put<Item>(`/items/${id}`, payload),
  remove: (id: number) => api.delete(`/items/${id}`),
  review: (id: number) => api.post<Item>(`/items/${id}/review`),
  skip: (id: number) => api.post<Item>(`/items/${id}/skip`),
  joinPlan: (id: number) => api.post<Item>(`/items/${id}/join-plan`),
  leavePlan: (id: number) => api.post<Item>(`/items/${id}/leave-plan`),
  joinPlanAll: (groupIds?: GroupFilterSelection, q?: string) =>
    api.post<{ count: number }>("/items/join-plan-all", null, {
      params: {
        ...groupFilterParams(groupIds),
        ...(q ? { q } : {}),
      },
    }),
  leavePlanAll: (groupIds?: GroupFilterSelection, q?: string) =>
    api.post<{ count: number }>("/items/leave-plan-all", null, {
      params: {
        ...groupFilterParams(groupIds),
        ...(q ? { q } : {}),
      },
    }),
  deleteAll: (groupIds?: GroupFilterSelection, q?: string) =>
    api.post<{ count: number }>("/items/delete-all", null, {
      params: {
        ...groupFilterParams(groupIds),
        ...(q ? { q } : {}),
      },
    }),
};

export interface WordExample {
  en: string;
  zh: string;
}

export interface WordPayload {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  example_translation: string;
  examples: WordExample[];
  group_id: number | null;
  learned_at?: string;
  stage_index?: number;
  in_plan?: boolean;
}

export interface DictionaryEntry {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
  example_translation: string;
  definition: string;
  found: boolean;
}

export interface ConfusablePairFromReviewPreview {
  eligible: boolean;
  already_exists: boolean;
  correct_word: string;
  typed_word: string;
  typed_meaning: string;
  typed_phonetic: string;
}

export const dictionaryApi = {
  lookup: (word: string) =>
    api.get<DictionaryEntry>(`/dictionary/lookup/${encodeURIComponent(word)}`),
};

export const wordApi = {
  list: (
    groupIds?: GroupFilterSelection,
    inPlan?: boolean | null,
    q?: string
  ) =>
    api.get<Word[]>("/words", {
      params: {
        ...groupFilterParams(groupIds),
        ...(inPlan != null ? { in_plan: inPlan } : {}),
        ...(q ? { q } : {}),
      },
    }),
  create: (payload: WordPayload) => api.post<Word>("/words", payload),
  update: (id: number, payload: Partial<WordPayload>) =>
    api.put<Word>(`/words/${id}`, payload),
  remove: (id: number) => api.delete(`/words/${id}`),
  review: (id: number, track: WordReviewTrack = "spell") =>
    api.post<Word>(`/words/${id}/review`, null, { params: { track } }),
  skip: (id: number, track: WordReviewTrack = "spell") =>
    api.post<Word>(`/words/${id}/skip`, null, { params: { track } }),
  resetStage: (id: number, track: WordReviewTrack = "spell") =>
    api.post<Word>(`/words/${id}/reset-stage`, null, { params: { track } }),
  joinPlan: (id: number) => api.post<Word>(`/words/${id}/join-plan`),
  leavePlan: (id: number) => api.post<Word>(`/words/${id}/leave-plan`),
  joinPlanAll: (groupIds?: GroupFilterSelection, q?: string) =>
    api.post<{ count: number }>("/words/join-plan-all", null, {
      params: {
        ...groupFilterParams(groupIds),
        ...(q ? { q } : {}),
      },
    }),
  leavePlanAll: (groupIds?: GroupFilterSelection, q?: string) =>
    api.post<{ count: number }>("/words/leave-plan-all", null, {
      params: {
        ...groupFilterParams(groupIds),
        ...(q ? { q } : {}),
      },
    }),
  deleteAll: (groupIds?: GroupFilterSelection, q?: string) =>
    api.post<{ count: number }>("/words/delete-all", null, {
      params: {
        ...groupFilterParams(groupIds),
        ...(q ? { q } : {}),
      },
    }),
};

export const reviewApi = {
  today: (groupIds?: GroupFilterSelection) =>
    api.get<ReviewItem[]>("/reviews/today", {
      params: groupFilterParams(groupIds),
    }),
  todayWords: (groupIds?: GroupFilterSelection, track: WordReviewTrack = "spell") =>
    api.get<ReviewWord[]>("/reviews/today/words", {
      params: { ...groupFilterParams(groupIds), track },
    }),
  todayConfusablePairs: () =>
    api.get<ReviewConfusablePair[]>("/reviews/today/confusable-pairs"),
  todayCompleted: (groupIds?: GroupFilterSelection) =>
    api.get<ReviewedTodayResponse>("/reviews/today/completed", {
      params: groupFilterParams(groupIds),
    }),
  calendar: (start: string, end: string, groupIds?: GroupFilterSelection) =>
    api.get<CalendarResponse>("/calendar", {
      params: {
        start,
        end,
        ...groupFilterParams(groupIds),
      },
    }),
};

export const confusablePairApi = {
  list: (inPlan?: boolean | null, q?: string) =>
    api.get<ConfusablePair[]>("/confusable-pairs", {
      params: {
        ...(inPlan != null ? { in_plan: inPlan } : {}),
        ...(q ? { q } : {}),
      },
    }),
  create: (payload: { word_a: string; word_b: string }) =>
    api.post<{ created: boolean; pair: ConfusablePair | null }>(
      "/confusable-pairs",
      payload
    ),
  createFromReview: (payload: { source_word_id: number; typed_word: string }) =>
    api.post<{ created: boolean; pair: ConfusablePair | null }>(
      "/confusable-pairs/from-review",
      payload
    ),
  previewFromReview: (sourceWordId: number, typedWord: string) =>
    api.get<ConfusablePairFromReviewPreview>("/confusable-pairs/from-review/preview", {
      params: { source_word_id: sourceWordId, typed_word: typedWord },
    }),
  review: (id: number) => api.post<ConfusablePair>(`/confusable-pairs/${id}/review`),
  skip: (id: number) => api.post<ConfusablePair>(`/confusable-pairs/${id}/skip`),
  resetStage: (id: number) =>
    api.post<ConfusablePair>(`/confusable-pairs/${id}/reset-stage`),
  updateExample: (
    id: number,
    payload: {
      side: "a" | "b";
      example: string;
      example_translation: string;
    }
  ) => api.patch<ConfusablePair>(`/confusable-pairs/${id}/example`, payload),
  diffAnalysis: (id: number) =>
    api.post<{ cached: boolean; analysis: ConfusableDiffAnalysis }>(
      `/confusable-pairs/${id}/diff-analysis`
    ),
  joinPlan: (id: number) =>
    api.post<ConfusablePair>(`/confusable-pairs/${id}/join-plan`),
  leavePlan: (id: number) =>
    api.post<ConfusablePair>(`/confusable-pairs/${id}/leave-plan`),
  remove: (id: number) => api.delete(`/confusable-pairs/${id}`),
  joinPlanAll: (q?: string) =>
    api.post<{ count: number }>("/confusable-pairs/join-plan-all", null, {
      params: q ? { q } : {},
    }),
  leavePlanAll: (q?: string) =>
    api.post<{ count: number }>("/confusable-pairs/leave-plan-all", null, {
      params: q ? { q } : {},
    }),
};

export interface ChatContext {
  group_names?: string[];
}

export const aiApi = {
  chat: (
    messages: { role: string; content: string }[],
    context?: ChatContext | null
  ) =>
    api.post<{ reply: string; effects: string[] }>("/ai/chat", {
      messages,
      ...(context && context.group_names && context.group_names.length > 0
        ? { context }
        : {}),
    }),
  generateWordExample: (payload: {
    word: string;
    meaning?: string;
    pos?: string;
    phonetic?: string;
    existing_examples?: WordExample[];
  }) =>
    api.post<WordExample>("/ai/generate-word-example", payload),
};

export const skillApi = {
  list: () => api.get<SkillCatalog[]>("/skills"),
  get: (id: number) => api.get<Skill>(`/skills/${id}`),
  remove: (id: number) => api.delete(`/skills/${id}`),
};

export interface ImportResult {
  mode: string;
  imported: {
    groups: number;
    words: number;
    items: number;
    confusable_pairs: number;
    skills: number;
  };
}

export const dataApi = {
  export: () => api.get<Blob>("/data/export", { responseType: "blob" }),
  import: (payload: unknown, mode: "merge" | "replace" = "merge") =>
    api.post<ImportResult>("/data/import", payload, { params: { mode } }),
};
