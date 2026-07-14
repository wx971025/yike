import { useEffect, useState } from "react";
import { authApi } from "../api";
import type { User } from "../types";
import { useAuth } from "../context/AuthContext";
import { AVATAR_PRESETS } from "../utils/userProfile";
import { CloseIcon } from "./ItemIcons";
import UserAvatar from "./UserAvatar";

interface UserProfileModalProps {
  onClose: () => void;
}

export default function UserProfileModal({ onClose }: UserProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setAvatar(user.avatar);
    }
  }, [user]);

  if (!user) return null;

  const previewUser: User = { ...user, nickname, avatar };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authApi.updateProfile({
        nickname: nickname.trim(),
        avatar,
      });
      updateUser(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "保存失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">个人资料</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex items-center gap-4">
            <UserAvatar user={previewUser} />
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {nickname.trim() || user.username}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500">@{user.username}</div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              头像
            </label>
            <div className="grid grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => setAvatar("")}
                className={`flex h-10 items-center justify-center rounded-lg border text-xs transition ${
                  avatar === ""
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600"
                }`}
              >
                默认
              </button>
              {AVATAR_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`flex h-10 items-center justify-center rounded-lg border text-lg transition ${
                    avatar === emoji
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              昵称
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={user.username}
              maxLength={64}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              留空则显示用户名
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
