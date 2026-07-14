import type { User } from "../types";

export function displayName(user: Pick<User, "nickname" | "username">): string {
  return user.nickname.trim() || user.username;
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
];

export function avatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const AVATAR_PRESETS = [
  "😀",
  "🦊",
  "🐱",
  "🐶",
  "🐼",
  "🦁",
  "🐸",
  "🦄",
  "🌸",
  "⭐",
  "🔥",
  "📚",
];
