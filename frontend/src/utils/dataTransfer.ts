import { dataApi } from "../api";
import { isDesktopApp } from "./onboarding";

declare global {
  interface Window {
    pywebview?: {
      api?: {
        save_export?: (
          content: string,
          filename: string
        ) => Promise<{
          ok: boolean;
          path?: string;
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

export async function exportUserData(): Promise<{ saved: boolean; path?: string }> {
  const res = await dataApi.export();
  const filename = parseExportFilename(res.headers?.["content-disposition"]);
  const content = await (res.data as Blob).text();

  if (isDesktopApp() && window.pywebview?.api?.save_export) {
    const result = await window.pywebview.api.save_export(content, filename);
    if (result.cancelled) {
      return { saved: false };
    }
    if (!result.ok) {
      throw new Error(result.error ?? "保存失败");
    }
    return { saved: true, path: result.path };
  }

  downloadJsonInBrowser(content, filename);
  return { saved: true };
}
