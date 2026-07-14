import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./ItemIcons";
import type { CalendarDay } from "../types";
import { todayStr } from "../utils/reviewSchedule";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startPad);
  const cells: { date: string; inMonth: boolean }[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: formatDate(d.getFullYear(), d.getMonth(), d.getDate()),
      inMonth: d.getMonth() === month,
    });
  }

  return cells;
}

interface ReviewCalendarProps {
  days: CalendarDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onRangeChange: (start: string, end: string) => void;
}

export default function ReviewCalendar({
  days,
  selectedDate,
  onSelectDate,
  onRangeChange,
}: ReviewCalendarProps) {
  const today = todayStr();
  const initial = parseDate(today);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of days) {
      map.set(day.date, day.items.length);
    }
    return map;
  }, [days]);

  useEffect(() => {
    onRangeChange(cells[0].date, cells[cells.length - 1].date);
  }, [cells, onRangeChange]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToday = () => {
    const t = parseDate(today);
    setYear(t.year);
    setMonth(t.month);
    onSelectDate(today);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            title="上个月"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            title="下个月"
          >
            <ChevronRightIcon />
          </button>
        </div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {year} 年 {month + 1} 月
        </h2>
        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          今天
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium text-slate-400 dark:text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const count = countByDate.get(cell.date) ?? 0;
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => onSelectDate(cell.date)}
              className={`relative flex min-h-[4.5rem] flex-col rounded-xl border p-2 text-left transition ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : isToday
                    ? "border-blue-200 bg-blue-50/40"
                    : cell.inMonth
                      ? "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      : "border-transparent bg-slate-50 dark:bg-slate-800/50 text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  !cell.inMonth
                    ? "text-slate-300"
                    : isSelected || isToday
                      ? "text-blue-700"
                      : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {parseDate(cell.date).day}
              </span>
              {count > 0 && cell.inMonth && (
                <span className="mt-auto inline-flex w-fit items-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                  {count} 项
                </span>
              )}
              {count > 0 && !cell.inMonth && (
                <span className="mt-auto h-1.5 w-1.5 rounded-full bg-blue-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
