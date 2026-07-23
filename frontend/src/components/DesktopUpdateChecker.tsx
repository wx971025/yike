import { useEffect, useState } from "react";
import DesktopUpdateModal from "./DesktopUpdateModal";
import {
  checkDesktopUpdate,
  isWithinUpdatePromptCooldown,
  markDesktopUpdateChecked,
  shouldPromptDesktopUpdate,
  type DesktopUpdateCheckResult,
} from "../utils/desktopUpdate";
import { isDesktopApp } from "../utils/onboarding";

export default function DesktopUpdateChecker() {
  const [checkResult, setCheckResult] = useState<DesktopUpdateCheckResult | null>(
    null
  );

  useEffect(() => {
    if (!isDesktopApp()) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await checkDesktopUpdate(false);
        if (cancelled) return;
        if (!shouldPromptDesktopUpdate(result)) return;
        if (isWithinUpdatePromptCooldown(result.last_check_at)) return;
        await markDesktopUpdateChecked();
        if (cancelled) return;
        setCheckResult(result);
      } catch {
        // 启动检查失败时静默忽略
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!checkResult) return null;

  return (
    <DesktopUpdateModal
      initialCheck={checkResult}
      onClose={() => setCheckResult(null)}
    />
  );
}
