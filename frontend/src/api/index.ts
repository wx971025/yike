import api from "./client";
import type {
  CalendarResponse,
  Group,
  Item,
  ReviewItem,
  ReviewWord,
  ReviewedTodayResponse,
  Skill,
  SkillCatalog,
  AiConfig,
  User,
  Word,
} from "../types";

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
  getAiConfig: () => api.get<AiConfig>("/auth/ai-config"),
  updateAiConfig: (payload: {
    use_custom?: boolean;
    base_url?: string;
    api_key?: string;
    model?: string;
  }) => api.put<AiConfig>("/auth/ai-config", payload),
};

export const groupApi = {
  list: (q?: string) =>
    api.get<Group[]>("/groups", { params: q ? { q } : {} }),
  create: (name: string, memory_mode?: string) =>
    api.post<Group>("/groups", { name, memory_mode }),
  update: (id: number, payload: { name?: string; memory_mode?: string }) =>
    api.put<Group>(`/groups/${id}`, payload),
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
  list: (groupId?: number | null, inPlan?: boolean | null, q?: string) =>
    api.get<Item[]>("/items", {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
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
  joinPlanAll: (groupId?: number | null, q?: string) =>
    api.post<{ count: number }>("/items/join-plan-all", null, {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(q ? { q } : {}),
      },
    }),
  leavePlanAll: (groupId?: number | null, q?: string) =>
    api.post<{ count: number }>("/items/leave-plan-all", null, {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(q ? { q } : {}),
      },
    }),
  deleteAll: (groupId?: number | null, q?: string) =>
    api.post<{ count: number }>("/items/delete-all", null, {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(q ? { q } : {}),
      },
    }),
};

export interface WordPayload {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  example: string;
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
  definition: string;
  found: boolean;
}

export const dictionaryApi = {
  lookup: (word: string) =>
    api.get<DictionaryEntry>(`/dictionary/lookup/${encodeURIComponent(word)}`),
};

export const wordApi = {
  list: (groupId?: number | null, inPlan?: boolean | null, q?: string) =>
    api.get<Word[]>("/words", {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(inPlan != null ? { in_plan: inPlan } : {}),
        ...(q ? { q } : {}),
      },
    }),
  create: (payload: WordPayload) => api.post<Word>("/words", payload),
  update: (id: number, payload: Partial<WordPayload>) =>
    api.put<Word>(`/words/${id}`, payload),
  remove: (id: number) => api.delete(`/words/${id}`),
  review: (id: number) => api.post<Word>(`/words/${id}/review`),
  skip: (id: number) => api.post<Word>(`/words/${id}/skip`),
  joinPlan: (id: number) => api.post<Word>(`/words/${id}/join-plan`),
  leavePlan: (id: number) => api.post<Word>(`/words/${id}/leave-plan`),
  joinPlanAll: (groupId?: number | null, q?: string) =>
    api.post<{ count: number }>("/words/join-plan-all", null, {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(q ? { q } : {}),
      },
    }),
  leavePlanAll: (groupId?: number | null, q?: string) =>
    api.post<{ count: number }>("/words/leave-plan-all", null, {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(q ? { q } : {}),
      },
    }),
  deleteAll: (groupId?: number | null, q?: string) =>
    api.post<{ count: number }>("/words/delete-all", null, {
      params: {
        ...(groupId != null ? { group_id: groupId } : {}),
        ...(q ? { q } : {}),
      },
    }),
};

export const reviewApi = {
  today: (groupId?: number | null) =>
    api.get<ReviewItem[]>("/reviews/today", {
      params: groupId != null ? { group_id: groupId } : {},
    }),
  todayWords: (groupId?: number | null) =>
    api.get<ReviewWord[]>("/reviews/today/words", {
      params: groupId != null ? { group_id: groupId } : {},
    }),
  todayCompleted: (groupId?: number | null) =>
    api.get<ReviewedTodayResponse>("/reviews/today/completed", {
      params: groupId != null ? { group_id: groupId } : {},
    }),
  calendar: (start: string, end: string, groupId?: number | null) =>
    api.get<CalendarResponse>("/calendar", {
      params: {
        start,
        end,
        ...(groupId != null ? { group_id: groupId } : {}),
      },
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
};

export const skillApi = {
  list: () => api.get<SkillCatalog[]>("/skills"),
  get: (id: number) => api.get<Skill>(`/skills/${id}`),
  remove: (id: number) => api.delete(`/skills/${id}`),
};
