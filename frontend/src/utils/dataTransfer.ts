import api, { getToken } from "../api/client";
import { dataApi } from "../api";
import { isDesktopApp } from "./onboarding";

declare global {
  interface Window {
    pywebview?: {
      api?: {
        save_export?: (
          filename?: string
        ) => Promise<{
          ok: boolean;
          path?: string;
          cancelled?: boolean;
          fallback?: boolean;
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

async function exportOnDesktop(): Promise<{ saved: boolean; path?: string }> {
  if (window.pywebview?.api?.save_export) {
    const result = await window.pywebview.api.save_export("");
    if (result.cancelled) {
      return { saved: false };
    }
    if (!result.ok) {
      throw new Error(result.error ?? "保存失败");
    }
    return { saved: true, path: result.path };
  }

  const res = await api.post<{ ok: boolean; path: string; filename: string }>(
    "/desktop/data/export/save"
  );
  if (!res.data.ok || !res.data.path) {
    throw new Error("保存失败");
  }
  return { saved: true, path: res.data.path };
}

export async function exportUserData(): Promise<{ saved: boolean; path?: string }> {
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
