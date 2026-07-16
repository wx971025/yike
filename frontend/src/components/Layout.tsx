import { useCallback, useEffect, useState } from "react";
import BrandMark from "./BrandMark";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import AiAssistant from "./AiAssistant";
import SettingsMenu from "./SettingsMenu";
import { ChevronDownIcon } from "./ItemIcons";
import { reviewApi, reminderApi } from "../api";
import {
  WordReviewUiProvider,
} from "../context/WordReviewUiContext";

const topNavItems = [
  { to: "/", label: "今日复习", icon: "📋", end: true },
  { to: "/plan", label: "计划管理", icon: "📝" },
  { to: "/groups", label: "分组管理", icon: "📁" },
  { to: "/calendar", label: "事项日历", icon: "📅" },
  { to: "/skills", label: "Agent技能管理", icon: "🤖" },
];

const cardNavGroup = {
  label: "卡片管理",
  icon: "📚",
  paths: ["/items", "/words", "/reminders"],
  children: [
    { to: "/items", label: "记忆卡片" },
    { to: "/words", label: "单词卡片" },
    { to: "/reminders", label: "事项卡片" },
  ],
};

function NavGroup({
  group,
  open,
  onToggle,
}: {
  group: typeof cardNavGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const isActiveSection = group.paths.includes(location.pathname);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActiveSection
            ? "bg-blue-50 text-blue-700"
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
  const [aiOpen, setAiOpen] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const isCardSection = cardNavGroup.paths.includes(location.pathname);
  const [cardsOpen, setCardsOpen] = useState(isCardSection);

  const loadDueCount = useCallback(async () => {
    try {
      const [cards, words, confusable, reminders] = await Promise.all([
        reviewApi.today(),
        reviewApi.todayWords(),
        reviewApi.todayConfusablePairs(),
        reminderApi.today(),
      ]);
      setDueCount(
        cards.data.length +
          words.data.length +
          confusable.data.length +
          reminders.data.length
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

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="shrink-0 border-b border-slate-100 dark:border-slate-800 px-5 py-5">
          <BrandMark />
        </div>

        <nav className="shrink-0 space-y-1 px-3 py-4">
          {topNavItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="text-base">{item.icon}</span>
                  {item.to === "/" ? (
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
                  )}
                </>
              )}
            </NavLink>
          ))}

          <NavGroup
            group={cardNavGroup}
            open={cardsOpen}
            onToggle={() => setCardsOpen((v) => !v)}
          />

          {topNavItems.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto shrink-0 border-t border-slate-100 dark:border-slate-800 px-3 py-4">
          <SettingsMenu />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      <AiAssistant collapsed={!aiOpen} onToggle={() => setAiOpen((v) => !v)} />
    </div>
  );
}
