import { useCallback, useEffect, useRef, useState } from "react";
import BrandMark from "./BrandMark";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import AiAssistant from "./AiAssistant";
import AiConfigModal from "./AiConfigModal";
import DesktopUpdateChecker from "./DesktopUpdateChecker";
import OnboardingTour from "./OnboardingTour";
import SettingsMenu from "./SettingsMenu";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "./ItemIcons";
import { reviewApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { WordReviewUiProvider } from "../context/WordReviewUiContext";
import { isOnboardingCompleted, hydrateOnboardingFromDesktop } from "../utils/onboarding";
import { loadSidebarCollapsed, saveSidebarCollapsed } from "../utils/sidebarPrefs";

const topNavItems = [
  { to: "/", label: "今日复习", icon: "📋", end: true },
  { to: "/plan", label: "计划管理", icon: "📝" },
  { to: "/groups", label: "分组管理", icon: "📁" },
  { to: "/calendar", label: "复习日历", icon: "📅" },
  { to: "/skills", label: "Agent技能管理", icon: "🤖" },
];

const cardNavGroup = {
  label: "卡片管理",
  icon: "📚",
  paths: ["/items", "/words"],
  children: [
    { to: "/items", label: "记忆卡片", icon: "🗂️" },
    { to: "/words", label: "单词卡片", icon: "🔤" },
  ],
};

function navLinkClass(collapsed: boolean, isActive: boolean): string {
  return `flex items-center rounded-lg py-2.5 text-sm font-medium transition ${
    collapsed ? "justify-center px-2" : "gap-3 px-3"
  } ${
    isActive
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
  }`;
}

function NavGroup({
  group,
  open,
  onToggle,
  collapsed,
}: {
  group: typeof cardNavGroup;
  open: boolean;
  onToggle: () => void;
  collapsed: boolean;
}) {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const isActiveSection = group.paths.includes(location.pathname);

  useEffect(() => {
    if (!flyoutOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [flyoutOpen]);

  useEffect(() => {
    setFlyoutOpen(false);
  }, [location.pathname]);

  if (collapsed) {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setFlyoutOpen((v) => !v)}
          title={group.label}
          className={`flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-base transition ${
            isActiveSection
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {group.icon}
        </button>
        {flyoutOpen && (
          <div className="absolute left-full top-0 z-40 ml-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <p className="px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
            {group.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                data-tour={child.to === "/words" ? "nav-words" : undefined}
                onClick={() => setFlyoutOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-blue-600 font-medium text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`
                }
              >
                <span>{child.icon}</span>
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActiveSection
            ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <span className="text-base">{group.icon}</span>
        <span className="flex-1 text-left">{group.label}</span>
        <span
          className={`text-slate-400 dark:text-slate-500 transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        >
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 pl-4">
          {group.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              data-tour={child.to === "/words" ? "nav-words" : undefined}
              className={({ isActive }) =>
                `block rounded-lg py-2 pl-7 pr-3 text-sm transition ${
                  isActive
                    ? "bg-blue-600 font-medium text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  return (
    <WordReviewUiProvider>
      <LayoutShell />
    </WordReviewUiProvider>
  );
}

function LayoutShell() {
  const location = useLocation();
  const { user } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiConfigModalOpen, setAiConfigModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const isCardSection = cardNavGroup.paths.includes(location.pathname);
  const [cardsOpen, setCardsOpen] = useState(isCardSection);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      saveSidebarCollapsed(next);
      return next;
    });
  };

  const loadDueCount = useCallback(async () => {
    try {
      const [cards, spellWords, recognizeWords, confusable] = await Promise.all([
        reviewApi.today(),
        reviewApi.todayWords(undefined, "spell"),
        reviewApi.todayWords(undefined, "recognize"),
        reviewApi.todayConfusablePairs(),
      ]);
      setDueCount(
        cards.data.length +
          spellWords.data.words.length +
          recognizeWords.data.words.length +
          confusable.data.length
      );
    } catch {
      setDueCount(0);
    }
  }, []);

  useEffect(() => {
    loadDueCount();
    const handler = () => loadDueCount();
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [loadDueCount]);

  useEffect(() => {
    if (isCardSection) setCardsOpen(true);
  }, [isCardSection]);

  useEffect(() => {
    if (!user) {
      setShowOnboarding(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const completed =
        isOnboardingCompleted(user.id) ||
        (await hydrateOnboardingFromDesktop(user.id));
      if (!cancelled) {
        setShowOnboarding(!completed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-900 ${
          sidebarCollapsed ? "w-[4.5rem]" : "w-56"
        }`}
      >
        <div
          className={`shrink-0 border-b border-slate-100 dark:border-slate-800 ${
            sidebarCollapsed ? "px-2 py-3" : "px-4 py-4"
          }`}
        >
          <div
            className={`flex items-center ${
              sidebarCollapsed ? "flex-col gap-2" : "justify-between gap-2"
            }`}
          >
            <BrandMark
              size={sidebarCollapsed ? "sm" : "md"}
              showText={!sidebarCollapsed}
              subtitle={sidebarCollapsed ? "" : undefined}
            />
            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>
        </div>

        <nav
          className={`shrink-0 space-y-1 py-4 ${
            sidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
          {topNavItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={sidebarCollapsed ? item.label : undefined}
              data-tour={
                item.to === "/"
                  ? "nav-review"
                  : item.to === "/plan"
                    ? "nav-plan"
                    : undefined
              }
              className={({ isActive }) => navLinkClass(sidebarCollapsed, isActive)}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative text-base ${
                      sidebarCollapsed ? "leading-none" : ""
                    }`}
                  >
                    {item.icon}
                    {sidebarCollapsed && item.to === "/" && dueCount > 0 && (
                      <span
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"
                        aria-hidden
                      />
                    )}
                  </span>
                  {!sidebarCollapsed &&
                    (item.to === "/" ? (
                      <span className="flex flex-1 items-center justify-between gap-2">
                        {item.label}
                        {dueCount > 0 && (
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full bg-red-500 ${
                              isActive ? "ring-2 ring-white" : ""
                            }`}
                            title={`${dueCount} 项待复习`}
                          />
                        )}
                      </span>
                    ) : (
                      item.label
                    ))}
                </>
              )}
            </NavLink>
          ))}

          <NavGroup
            group={cardNavGroup}
            open={cardsOpen}
            onToggle={() => setCardsOpen((v) => !v)}
            collapsed={sidebarCollapsed}
          />

          {topNavItems.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) => navLinkClass(sidebarCollapsed, isActive)}
            >
              <span className="text-base">{item.icon}</span>
              {!sidebarCollapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div
          className={`mt-auto shrink-0 border-t border-slate-100 dark:border-slate-800 py-4 ${
            sidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
          <SettingsMenu
            collapsed={sidebarCollapsed}
            onOpenAiConfig={() => setAiConfigModalOpen(true)}
          />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      <AiAssistant
        collapsed={!aiOpen}
        onToggle={() => setAiOpen((v) => !v)}
        onOpenAiConfig={() => setAiConfigModalOpen(true)}
      />

      {aiConfigModalOpen && (
        <AiConfigModal onClose={() => setAiConfigModalOpen(false)} />
      )}

      {showOnboarding && user && (
        <OnboardingTour
          userId={user.id}
          onExpandCardsNav={() => setCardsOpen(true)}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <DesktopUpdateChecker />
    </div>
  );
}
