import api, { getToken } from "../api/client";
import { dataApi, type ImportResult } from "../api";
import { isDesktopApp } from "./onboarding";

const SYNC_CODE_STORAGE_KEY = "yike_sync_code";

declare global {
  interface Window {
    pywebview?: {
      api?: {
        choose_export_dir?: () => Promise<{
          ok: boolean;
          dir?: string;
          cancelled?: boolean;
          error?: string;
        }>;
        save_export?: (
          exportDir: string
        ) => Promise<{
          ok: boolean;
          path?: string;
          dir?: string;
          cancelled?: boolean;
          error?: string;
        }>;
        get_app_version?: () => Promise<{ ok?: boolean; version?: string }>;
        quit_for_update?: () => Promise<{ ok?: boolean }>;
        run_update_installer?: (
          installerPath: string
        ) => Promise<{ ok?: boolean; error?: string }>;
      };
    };
  }
}

function parseExportFilename(contentDisposition: string | undefined): string {
  const disposition = contentDisposition ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match?.[1] ?? `yike-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function downloadJsonInBrowser(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function getDesktopExportDir(): Promise<string | null> {
  const res = await api.get<{ dir: string | null }>("/desktop/preferences/export-dir");
  return res.data.dir;
}

export async function chooseDesktopExportDir(): Promise<{
  ok: boolean;
  dir?: string;
  cancelled?: boolean;
}> {
  if (window.pywebview?.api?.choose_export_dir) {
    const result = await window.pywebview.api.choose_export_dir();
    if (result.cancelled) {
      return { ok: false, cancelled: true };
    }
    if (!result.ok || !result.dir) {
      throw new Error(result.error ?? "未选择文件夹");
    }
    return { ok: true, dir: result.dir };
  }
  throw new Error("当前环境无法选择文件夹，请使用桌面版");
}

async function exportOnDesktop(exportDir: string): Promise<{
  saved: boolean;
  path?: string;
  dir?: string;
}> {
  const dir = exportDir.trim();
  if (!dir) {
    throw new Error("请选择保存文件夹");
  }

  if (window.pywebview?.api?.save_export) {
    const result = await window.pywebview.api.save_export(dir);
    if (result.cancelled) {
      return { saved: false };
    }
    if (!result.ok) {
      throw new Error(result.error ?? "保存失败");
    }
    return { saved: true, path: result.path, dir: result.dir ?? dir };
  }

  const res = await api.post<{
    ok: boolean;
    path: string;
    filename: string;
    dir: string;
  }>("/desktop/data/export/save", { dir });
  if (!res.data.ok || !res.data.path) {
    throw new Error("保存失败");
  }
  return { saved: true, path: res.data.path, dir: res.data.dir };
}

export async function exportUserData(exportDir?: string): Promise<{
  saved: boolean;
  path?: string;
  dir?: string;
}> {
  if (isDesktopApp()) {
    if (!getToken()) {
      throw new Error("尚未登录，请重启应用后再试");
    }
    if (!exportDir?.trim()) {
      throw new Error("请选择保存文件夹");
    }
    return exportOnDesktop(exportDir);
  }

  const res = await dataApi.export();
  const filename = parseExportFilename(res.headers?.["content-disposition"]);
  const content = await (res.data as Blob).text();
  downloadJsonInBrowser(content, filename);
  return { saved: true };
}

export function formatExportError(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { detail?: string } } }).response?.data
      ?.detail === "string"
  ) {
    return (err as { response: { data: { detail: string } } }).response.data.detail;
  }
  return "导出失败，请稍后重试";
}

export function getStoredSyncCode(): string {
  return localStorage.getItem(SYNC_CODE_STORAGE_KEY) ?? "";
}

export function storeSyncCode(syncCode: string): void {
  localStorage.setItem(SYNC_CODE_STORAGE_KEY, syncCode.trim());
}

export async function pushLocalDataToCloud(syncCode: string): Promise<void> {
  const code = syncCode.trim();
  if (!code) {
    throw new Error("请输入同步码");
  }
  storeSyncCode(code);
  await api.post("/desktop/data/sync/push", { sync_code: code });
}

export async function pullCloudDataToLocal(syncCode: string): Promise<ImportResult> {
  const code = syncCode.trim();
  if (!code) {
    throw new Error("请输入同步码");
  }
  if (
    !window.confirm(
      "从云端同步将清空本机全部学习进度，并用云端数据覆盖。确定继续吗？"
    )
  ) {
    throw new Error("已取消同步");
  }
  storeSyncCode(code);
  const res = await api.post<ImportResult>("/desktop/data/sync/pull", {
    sync_code: code,
  });
  return res.data;
}

export function formatSyncError(err: unknown): string {
  if (err instanceof Error && err.message === "已取消同步") {
    return err.message;
  }
  return formatExportError(err);
}
