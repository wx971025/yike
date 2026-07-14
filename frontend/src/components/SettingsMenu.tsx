import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, type Theme } from "../context/ThemeContext";
import { displayName } from "../utils/userProfile";
import { GearIcon } from "./ItemIcons";
import AiConfigModal from "./AiConfigModal";
import UserAvatar from "./UserAvatar";
import UserProfileModal from "./UserProfileModal";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: "light", label: "白天", icon: "☀️" },
    { value: "dark", label: "黑夜", icon: "🌙" },
  ];

  return (
    <div className="px-3 py-2">
      <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">外观</p>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              theme === opt.value
                ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [aiConfigModalOpen, setAiConfigModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <>
      <div ref={menuRef} className="relative">
        <div className="relative mb-3">
          {open && (
            <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <ThemeToggle />
              <div className="border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setAiConfigModalOpen(true);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                AI 配置
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                退出登录
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="设置"
          >
            <GearIcon />
            <span>设置</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setProfileModalOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
          title="编辑个人资料"
        >
          <UserAvatar user={user} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {displayName(user)}
            </div>
            <div className="truncate text-xs text-slate-400 dark:text-slate-500">
              @{user.username}
            </div>
          </div>
        </button>
      </div>

      {profileModalOpen && (
        <UserProfileModal onClose={() => setProfileModalOpen(false)} />
      )}
      {aiConfigModalOpen && (
        <AiConfigModal onClose={() => setAiConfigModalOpen(false)} />
      )}
    </>
  );
}
