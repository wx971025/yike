import { useCallback, useEffect, useRef, useState } from "react";
import {
  dismissDesktopUpdate,
  fetchDesktopUpdateStatus,
  formatFileSize,
  formatReleaseNotes,
  installDesktopUpdate,
  runDesktopUpdateInstaller,
  startDesktopUpdateDownload,
  type DesktopUpdateCheckResult,
} from "../utils/desktopUpdate";

interface DesktopUpdateModalProps {
  initialCheck: DesktopUpdateCheckResult;
  onClose: () => void;
  manual?: boolean;
}

export default function DesktopUpdateModal({
  initialCheck,
  onClose,
  manual = false,
}: DesktopUpdateModalProps) {
  const [check] = useState(initialCheck);
  const [phase, setPhase] = useState<"prompt" | "downloading" | "ready" | "error">(
    "prompt"
  );
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollStatus = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      void (async () => {
        try {
          const status = await fetchDesktopUpdateStatus();
          setProgress(status.progress);
          setMessage(status.message);
          if (status.status === "ready") {
            stopPolling();
            setPhase("ready");
            setError("");
          } else if (status.status === "error") {
            stopPolling();
            setPhase("error");
            setError(status.error || "下载失败");
          }
        } catch (err) {
          stopPolling();
          setPhase("error");
          setError(err instanceof Error ? err.message : "获取下载状态失败");
        }
      })();
    }, 1000);
  }, [stopPolling]);

  const handleDownload = async () => {
    setBusy(true);
    setPhase("downloading");
    setError("");
    try {
      const status = await startDesktopUpdateDownload();
      setProgress(status.progress);
      setMessage(status.message);
      if (status.status === "ready") {
        setPhase("ready");
      } else if (status.status === "error") {
        setPhase("error");
        setError(status.error || "下载失败");
      } else {
        pollStatus();
      }
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "下载失败");
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    setBusy(true);
    setError("");
    try {
      const status = await fetchDesktopUpdateStatus();
      if (status.status !== "ready" || !status.file_path) {
        throw new Error("更新包尚未准备就绪");
      }
      await installDesktopUpdate();
      await runDesktopUpdateInstaller(status.file_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动安装失败");
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    if (check.latest_version) {
      await dismissDesktopUpdate(check.latest_version);
    }
    onClose();
  };

  const handleOpenReleasePage = () => {
    if (check.release_page) {
      window.open(check.release_page, "_blank", "noopener,noreferrer");
    }
  };

  const sizeLabel = formatFileSize(check.asset_size);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={() => {
        if (!busy && phase === "prompt") onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {manual && !check.update_available ? "检查更新" : "发现新版本"}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          当前版本 {check.current_version}
          {check.update_available ? ` → 最新 ${check.latest_version}` : ""}
          {sizeLabel ? ` · 安装包约 ${sizeLabel}` : ""}
        </p>

        {check.error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            检查失败：{check.error}
          </p>
        ) : null}

        {!check.update_available && !check.error ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            当前已是最新版本。
          </p>
        ) : null}

        {check.update_available && phase === "prompt" ? (
          <pre className="mt-4 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {formatReleaseNotes(check.release_notes)}
          </pre>
        ) : null}

        {phase === "downloading" ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{message || "正在下载…"}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.max(4, progress)}%` }}
              />
            </div>
          </div>
        ) : null}

        {phase === "ready" ? (
          <p className="mt-4 text-sm text-green-700 dark:text-green-300">
            更新包已下载，点击「立即安装」将退出当前应用并启动安装向导。
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {check.update_available && phase === "prompt" ? (
            <>
              <button
                type="button"
                onClick={() => void handleDismiss()}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                稍后提醒
              </button>
              {check.release_page ? (
                <button
                  type="button"
                  onClick={handleOpenReleasePage}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  查看 Release
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                立即更新
              </button>
            </>
          ) : null}

          {phase === "ready" ? (
            <button
              type="button"
              onClick={() => void handleInstall()}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "正在启动安装…" : "立即安装"}
            </button>
          ) : null}

          {(phase === "error" || !check.update_available || check.error) && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
