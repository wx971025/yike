import { useCallback, useEffect, useRef, useState } from "react";
import { reviewApi } from "../api";
import ReviewCalendar from "../components/ReviewCalendar";
import { CardKindBadge } from "../components/CardKindBadge";
import PageGroupFilter from "../components/PageGroupFilter";
import { useGroups } from "../context/GroupContext";
import type { CalendarDay } from "../types";
import { groupFilterLabel } from "../utils/groupFilter";
import { todayStr } from "../utils/reviewSchedule";

export default function CalendarPage() {
  const { groups } = useGroups();
  const [groupFilterIds, setGroupFilterIds] = useState<Set<number>>(new Set());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr());
  const rangeRef = useRef<{ start: string; end: string } | null>(null);

  const groupLabel = groupFilterLabel(groupFilterIds, groups);

  const fetchRange = useCallback(
    async (start: string, end: string) => {
      const res = await reviewApi.calendar(start, end, groupFilterIds);
      setDays(res.data.events);
    },
    [groupFilterIds]
  );

  const handleRangeChange = useCallback(
    (start: string, end: string) => {
      rangeRef.current = { start, end };
      fetchRange(start, end);
    },
    [fetchRange]
  );

  useEffect(() => {
    const handler = () => {
      if (rangeRef.current) {
        fetchRange(rangeRef.current.start, rangeRef.current.end);
      }
    };
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [fetchRange]);

  const selectedDayItems =
    days.find((d) => d.date === selectedDate)?.items ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">事项日历</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            当前显示：{groupLabel} 的复习与事项提醒，点击日期查看当天安排
          </p>
        </div>
        <PageGroupFilter
          selectedIds={groupFilterIds}
          onChange={setGroupFilterIds}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
          <ReviewCalendar
            days={days}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onRangeChange={handleRangeChange}
          />
        </div>

        <div className="flex max-h-[calc(100vh-10rem)] min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="shrink-0">
            <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
              {selectedDate ? selectedDate : "选择日期"}
            </h2>
            <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">
              {selectedDate
                ? selectedDayItems.length > 0
                  ? `共 ${selectedDayItems.length} 项安排`
                  : "当天没有安排"
                : "点击日历中的日期查看详情"}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedDate && selectedDayItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                暂无安排
              </div>
            )}

            <ul className="space-y-2">
              {selectedDayItems.map((item) => (
                <li
                  key={`${item.kind}-${item.id}-${item.stage_index}`}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/60"
                >
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {item.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <CardKindBadge kind={item.kind} />
                    {item.kind === "reminder" ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        事项提醒
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        第 {item.stage} 轮复习
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
