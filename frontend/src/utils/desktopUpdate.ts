import { isDesktopApp } from "./onboarding";

export interface DesktopUpdateCheckResult {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  download_url?: string;
  asset_size?: number;
  release_page?: string;
  release_notes?: string;
  dismissed_version?: string | null;
  last_check_at?: string | null;
  error?: string;
}

export interface DesktopUpdateStatus {
  status: "idle" | "downloading" | "ready" | "error";
  progress: number;
  message: string;
  error: string;
  version: string;
  file_path: string;
  expected_size: number;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      // ignore
    }
    throw new Error(detail || "请求失败");
  }
  return (await res.json()) as T;
}

export async function fetchDesktopVersion(): Promise<string> {
  const res = await fetch("/api/desktop/version");
  const data = await parseJson<{ version: string }>(res);
  return data.version;
}

export async function checkDesktopUpdate(
  recordCheck = false
): Promise<DesktopUpdateCheckResult> {
  const params = recordCheck ? "?record_check=true" : "";
  const res = await fetch(`/api/desktop/update/check${params}`);
  return parseJson<DesktopUpdateCheckResult>(res);
}

export async function dismissDesktopUpdate(version: string): Promise<void> {
  await parseJson(
    await fetch("/api/desktop/update/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    })
  );
}

export async function startDesktopUpdateDownload(): Promise<DesktopUpdateStatus> {
  const res = await fetch("/api/desktop/update/download", { method: "POST" });
  return parseJson<DesktopUpdateStatus>(res);
}

export async function fetchDesktopUpdateStatus(): Promise<DesktopUpdateStatus> {
  const res = await fetch("/api/desktop/update/status");
  return parseJson<DesktopUpdateStatus>(res);
}

export async function installDesktopUpdate(): Promise<void> {
  await parseJson(await fetch("/api/desktop/update/install", { method: "POST" }));
}

export async function quitDesktopAppForUpdate(): Promise<void> {
  const api = window.pywebview?.api as
    | { quit_for_update?: () => Promise<{ ok?: boolean }> }
    | undefined;
  const quit = api?.quit_for_update;
  if (typeof quit === "function") {
    await quit();
    return;
  }
  window.close();
}

export function shouldPromptDesktopUpdate(
  result: DesktopUpdateCheckResult,
  options?: { ignoreDismissed?: boolean }
): boolean {
  if (!isDesktopApp() || !result.update_available || result.error) {
    return false;
  }
  if (!options?.ignoreDismissed && result.dismissed_version === result.latest_version) {
    return false;
  }
  return true;
}

export function isWithinUpdatePromptCooldown(lastCheckAt?: string | null): boolean {
  if (!lastCheckAt) return false;
  const last = Date.parse(lastCheckAt);
  if (Number.isNaN(last)) return false;
  return Date.now() - last < CHECK_INTERVAL_MS;
}

export async function markDesktopUpdateChecked(): Promise<void> {
  await fetch("/api/desktop/update/mark-checked", { method: "POST" });
}

export function formatReleaseNotes(notes?: string, maxLines = 6): string {
  if (!notes?.trim()) return "暂无更新说明。";
  return notes
    .split(/\r?\n/)
    .slice(0, maxLines)
    .join("\n")
    .trim();
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
