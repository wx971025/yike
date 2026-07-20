import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ONBOARDING_STEPS,
  markOnboardingCompleted,
} from "../utils/onboarding";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTourProps {
  userId: number;
  onExpandCardsNav: () => void;
  onComplete: () => void;
}

function measureRect(
  rect: DOMRect,
  padding = 6
): SpotlightRect {
  return {
    top: Math.max(8, rect.top - padding),
    left: Math.max(8, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function measureTarget(selector: string | undefined): SpotlightRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return measureRect(el.getBoundingClientRect());
}

function tooltipStyle(
  rect: SpotlightRect | null,
  isWelcome: boolean
): CSSProperties {
  if (isWelcome || !rect) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth: "22rem",
    };
  }

  const cardWidth = 288;
  const margin = 16;
  let top = rect.top + rect.height + margin;
  let left = rect.left;

  if (top + 180 > window.innerHeight) {
    top = Math.max(margin, rect.top - 180 - margin);
  }
  if (left + cardWidth > window.innerWidth - margin) {
    left = window.innerWidth - cardWidth - margin;
  }
  left = Math.max(margin, left);

  return {
    top,
    left,
    maxWidth: `${cardWidth}px`,
  };
}

export default function OnboardingTour({
  userId,
  onExpandCardsNav,
  onComplete,
}: OnboardingTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = ONBOARDING_STEPS[stepIndex];
  const isWelcome = !step.target;
  const isLast = stepIndex >= ONBOARDING_STEPS.length - 1;

  const finish = useCallback(() => {
    markOnboardingCompleted(userId);
    onComplete();
  }, [userId, onComplete]);

  const updateSpotlight = useCallback(() => {
    if (isWelcome) {
      if (!tooltipRef.current) {
        setSpotlight(null);
        return;
      }
      setSpotlight(measureRect(tooltipRef.current.getBoundingClientRect(), 10));
      return;
    }
    setSpotlight(measureTarget(step.target));
  }, [isWelcome, step.target]);

  useEffect(() => {
    if (step.expandCards) onExpandCardsNav();
    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
      return;
    }

    const timers = [80, 240, 480].map((ms) =>
      window.setTimeout(updateSpotlight, ms)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [
    stepIndex,
    step.path,
    step.expandCards,
    location.pathname,
    navigate,
    onExpandCardsNav,
    updateSpotlight,
  ]);

  useEffect(() => {
    const onLayoutChange = () => updateSpotlight();
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [updateSpotlight]);

  useLayoutEffect(() => {
    if (!isWelcome) return;
    updateSpotlight();
  }, [isWelcome, stepIndex, updateSpotlight]);

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((index) => index + 1);
  };

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true">
      {!spotlight && (
        <div
          className="absolute inset-0 bg-slate-900/72"
          aria-hidden
        />
      )}
      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent transition-all duration-300"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.72)",
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="absolute z-[121] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        style={tooltipStyle(spotlight, isWelcome)}
      >
        <p className="mb-1 text-xs font-medium text-blue-600 dark:text-blue-300">
          新手引导 {stepIndex + 1}/{ONBOARDING_STEPS.length}
        </p>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {step.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {step.description}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            跳过引导
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {isLast ? "开始使用" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
