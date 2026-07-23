import { useEffect, useRef, useState } from "react";
import { dataApi } from "../api";
import {
  chooseDesktopExportDir,
  exportUserData,
  formatExportError,
  formatSyncError,
  getDesktopExportDir,
  getStoredSyncCode,
  pullCloudDataToLocal,
  pushLocalDataToCloud,
  storeSyncCode,
} from "../utils/dataTransfer";
import { isDesktopApp } from "../utils/onboarding";
import { copyTextToClipboard } from "../utils/clipboard";
import { CloseIcon } from "./ItemIcons";

interface DataTransferModalProps {
  onClose: () => void;
}

type View = "menu" | "export";

export default function DataTransferModal({ onClose }: DataTransferModalProps) {
  const [view, setView] = useState<View>("menu");
  const [busy, setBusy] = useState(false);
  const [exportDir, setExportDir] = useState("");
  const [message, setMessage] = useState("");
  const [syncCode, setSyncCode] = useState("");
  const [syncCodeLoading, setSyncCodeLoading] = useState(false);
  const [copyHint, setCopyHint] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncCodeInputRef = useRef<HTMLInputElement>(null);
  const desktop = isDesktopApp();

  useEffect(() => {
    if (desktop) {
      setSyncCode(getStoredSyncCode());
      return;
    }
    setSyncCodeLoading(true);
    dataApi
      .getSyncCode()
      .then((res) => setSyncCode(res.data.sync_code))
      .catch(() => setMessage("同步码加载失败，请稍后重试"))
      .finally(() => setSyncCodeLoading(false));
  }, [desktop]);

  useEffect(() => {
    if (!desktop || view !== "export") return;
    getDesktopExportDir()
      .then((dir) => {
        if (dir) setExportDir(dir);
      })
      .catch(() => {});
  }, [view, desktop]);

  const handleCopySyncCode = async () => {
    if (!syncCode || busy) return;
    syncCodeInputRef.current?.focus();
    syncCodeInputRef.current?.select();
    const ok = await copyTextToClipboard(syncCode);
    setCopyHint(ok ? "已复制" : "请手动 Ctrl+C");
    window.setTimeout(() => setCopyHint(""), 2000);
  };

  const handleImportClick = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const replace = window.confirm(
      "导入方式：\n\n【确定】清空当前账号数据后再导入（推荐用于换新设备）\n【取消】保留现有数据并追加导入"
    );

    setBusy(true);
    setMessage("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await dataApi.import(payload, replace ? "replace" : "merge");
      const c = res.data.imported;
      window.dispatchEvent(new CustomEvent("app-data-changed"));
      window.alert(
        `导入完成：\n分组 ${c.groups}｜单词 ${c.words}｜记忆卡片 ${c.items}｜易混词 ${c.confusable_pairs}｜技能 ${c.skills}`
      );
      onClose();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setMessage("导入失败：文件不是有效的备份文件");
      } else {
        setMessage("导入失败，请确认选择的是本应用导出的备份文件");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleBrowseExportDir = async () => {
    if (busy || !desktop) return;
    setBusy(true);
    setMessage("");
    try {
      const picked = await chooseDesktopExportDir();
      if (picked.ok && picked.dir) {
        setExportDir(picked.dir);
      }
    } catch (err) {
      setMessage(formatExportError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmExport = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await exportUserData(desktop ? exportDir : undefined);
      if (result.saved) {
        if (result.path) {
          window.alert(`导出成功，已保存到：\n${result.path}`);
        }
        onClose();
        return;
      }
      setMessage("已取消导出");
    } catch (err) {
      setMessage(formatExportError(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePushToCloud = async () => {
    if (busy) return;
    const code = syncCode.trim();
    if (!code) {
      setMessage("请输入 Web 端账号的同步码");
      return;
    }
    if (
      !window.confirm(
        "上传至云端将清空该 Web 账号的全部学习进度，并用本机数据覆盖。确定继续吗？"
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      storeSyncCode(code);
      await pushLocalDataToCloud(code);
      window.alert("已上传至云端，可在 Web 端刷新查看");
      onClose();
    } catch (err) {
      setMessage(formatSyncError(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (busy) return;
    const code = syncCode.trim();
    if (!code) {
      setMessage("请输入 Web 端账号的同步码");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await pullCloudDataToLocal(code);
      const c = res.imported;
      window.dispatchEvent(new CustomEvent("app-data-changed"));
      window.alert(
        `已从云端同步：\n分组 ${c.groups}｜单词 ${c.words}｜记忆卡片 ${c.items}｜易混词 ${c.confusable_pairs}｜技能 ${c.skills}`
      );
      onClose();
    } catch (err) {
      setMessage(formatSyncError(err));
    } finally {
      setBusy(false);
    }
  };

  const title = view === "menu" ? "数据备份与同步" : "导出数据";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        {view === "menu" ? (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              导入或导出本地备份（JSON），或通过同步码与 Web 账号互相同步进度。
            </p>

            {desktop ? (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  同步码
                </label>
                <input
                  value={syncCode}
                  onChange={(e) => setSyncCode(e.target.value)}
                  placeholder="粘贴 Web 端显示的同步码"
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  在 Web 端「数据备份与同步」中查看本账号同步码。
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handlePushToCloud}
                    disabled={busy}
                    className="rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    上传至云端
                  </button>
                  <button
                    type="button"
                    onClick={handlePullFromCloud}
                    disabled={busy}
                    className="rounded-lg border border-indigo-200 px-3 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  >
                    从云端同步
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    同步码
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySyncCode}
                    disabled={busy || syncCodeLoading || !syncCode}
                    className="rounded-md px-2 py-1 text-xs text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                  >
                    {copyHint || "复制"}
                  </button>
                </div>
                <input
                  ref={syncCodeInputRef}
                  readOnly
                  value={syncCodeLoading ? "加载中…" : syncCode}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                />
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  每账号唯一，不可修改或删除。在桌面版输入此码即可上传或拉取进度。
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleImportClick}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                导入数据
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setView("export");
                }}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                导出数据
              </button>
            </div>

            {message && (
              <p className="text-sm text-red-500 dark:text-red-400">{message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            {desktop ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    保存位置
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={exportDir}
                      placeholder="请选择保存文件夹"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleBrowseExportDir}
                      disabled={busy}
                      className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      浏览…
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    将在此文件夹内生成 `yike-backup-日期时间.json` 备份文件。
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                点击「确定导出」后，浏览器会下载 JSON 备份文件。
              </p>
            )}

            {message && (
              <p className="text-sm text-red-500 dark:text-red-400">{message}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setView("menu");
                }}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                返回
              </button>
              <button
                type="button"
                onClick={handleConfirmExport}
                disabled={busy || (desktop && !exportDir.trim())}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "正在导出…" : "确定导出"}
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>
    </div>
  );
}
