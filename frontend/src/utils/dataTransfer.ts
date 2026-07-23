import api, { getToken } from "../api/client";
import { dataApi } from "../api";
import { isDesktopApp } from "./onboarding";

declare global {
  interface Window {
    pywebview?: {
      api?: {
        get_export_dir?: () => Promise<{ ok: boolean; dir?: string | null }>;
        choose_export_dir?: () => Promise<{
          ok: boolean;
          dir?: string;
          cancelled?: boolean;
          error?: string;
        }>;
        save_export?: (
          filename?: string
        ) => Promise<{
          ok: boolean;
          path?: string;
          dir?: string;
          cancelled?: boolean;
          error?: string;
        }>;
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
  if (window.pywebview?.api?.get_export_dir) {
    const result = await window.pywebview.api.get_export_dir();
    return result.dir ?? null;
  }
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

async function ensureDesktopExportDir(): Promise<string | null> {
  const existing = await getDesktopExportDir();
  if (existing) {
    return existing;
  }

  const proceed = window.confirm(
    "首次导出需要先选择备份保存文件夹。\n\n点击「确定」后，请在弹出的窗口中选择一个文件夹。"
  );
  if (!proceed) {
    return null;
  }

  const picked = await chooseDesktopExportDir();
  if (!picked.ok) {
    return null;
  }
  return picked.dir ?? null;
}

async function exportOnDesktop(): Promise<{ saved: boolean; path?: string; dir?: string }> {
  const exportDir = await ensureDesktopExportDir();
  if (!exportDir) {
    return { saved: false };
  }

  if (window.pywebview?.api?.save_export) {
    const result = await window.pywebview.api.save_export("");
    if (result.cancelled) {
      return { saved: false };
    }
    if (!result.ok) {
      throw new Error(result.error ?? "保存失败");
    }
    return { saved: true, path: result.path, dir: result.dir ?? exportDir };
  }

  const res = await api.post<{
    ok: boolean;
    path: string;
    filename: string;
    dir: string;
  }>("/desktop/data/export/save");
  if (!res.data.ok || !res.data.path) {
    throw new Error("保存失败");
  }
  return { saved: true, path: res.data.path, dir: res.data.dir };
}

export async function exportUserData(): Promise<{
  saved: boolean;
  path?: string;
  dir?: string;
}> {
  if (isDesktopApp()) {
    if (!getToken()) {
      throw new Error("尚未登录，请重启应用后再试");
    }
    return exportOnDesktop();
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
