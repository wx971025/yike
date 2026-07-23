import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme, type Theme } from "../context/ThemeContext";
import { displayName } from "../utils/userProfile";
import DataTransferModal from "./DataTransferModal";
import DesktopUpdateModal from "./DesktopUpdateModal";
import { GearIcon } from "./ItemIcons";
import UserAvatar from "./UserAvatar";
import UserProfileModal from "./UserProfileModal";
import { checkDesktopUpdate, fetchDesktopVersion } from "../utils/desktopUpdate";
import { isDesktopApp } from "../utils/onboarding";

interface SettingsMenuProps {
  onOpenAiConfig: () => void;
}

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

export default function SettingsMenu({ onOpenAiConfig }: SettingsMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [dataTransferOpen, setDataTransferOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateCheck, setUpdateCheck] = useState<Awaited<
    ReturnType<typeof checkDesktopUpdate>
  > | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDesktopApp()) return;
    void fetchDesktopVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(null));
  }, []);

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

  const handleCheckUpdate = async () => {
    setOpen(false);
    setUpdateChecking(true);
    try {
      const result = await checkDesktopUpdate(false);
      setUpdateCheck(result);
      setUpdateModalOpen(true);
    } catch (err) {
      setUpdateCheck({
        current_version: appVersion || "—",
        latest_version: appVersion || "—",
        update_available: false,
        error: err instanceof Error ? err.message : "检查更新失败",
      });
      setUpdateModalOpen(true);
    } finally {
      setUpdateChecking(false);
    }
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
                  onOpenAiConfig();
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                AI 配置
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDataTransferOpen(true);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                数据备份与同步
              </button>
              {isDesktopApp() ? (
                <>
                  <div className="border-t border-slate-100 dark:border-slate-800" />
                  <button
                    type="button"
                    onClick={() => void handleCheckUpdate()}
                    disabled={updateChecking}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {updateChecking
                      ? "正在检查更新…"
                      : `检查更新${appVersion ? ` (v${appVersion})` : ""}`}
                  </button>
                </>
              ) : null}
              <div className="border-t border-slate-100 dark:border-slate-800" />
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

      {dataTransferOpen && (
        <DataTransferModal onClose={() => setDataTransferOpen(false)} />
      )}

      {updateModalOpen && updateCheck && (
        <DesktopUpdateModal
          initialCheck={updateCheck}
          manual
          onClose={() => {
            setUpdateModalOpen(false);
            setUpdateCheck(null);
          }}
        />
      )}
    </>
  );
}
