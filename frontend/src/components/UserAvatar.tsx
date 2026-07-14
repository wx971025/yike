import type { User } from "../types";
import { avatarColor, displayName } from "../utils/userProfile";

interface UserAvatarProps {
  user: Pick<User, "nickname" | "username" | "avatar">;
  size?: "sm" | "md";
}

export default function UserAvatar({ user, size = "md" }: UserAvatarProps) {
  const name = displayName(user);
  const sizeClass = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-base";

  if (user.avatar) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800`}
      >
        <span className={size === "sm" ? "text-base" : "text-lg"}>{user.avatar}</span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${avatarColor(user.username)}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
