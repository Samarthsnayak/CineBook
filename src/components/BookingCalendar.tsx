import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarDayInfo } from '../types/cinebook';
import { formatDateLabel } from '../lib/api';

interface BookingCalendarProps {
  todayDate: string; // YYYY-MM-DD (IST)
  selectedDate: string; // YYYY-MM-DD
  calendarDays: CalendarDayInfo[];
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseYMD(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y || 2026, month: (m || 1) - 1, day: d || 1 };
}

function toYMD(year: number, monthZeroIdx: number, day: number): string {
  return `${year}-${String(monthZeroIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function BookingCalendar({
  todayDate,
  selectedDate,
  calendarDays,
  onSelectDate,
}: BookingCalendarProps) {
  const [showMonthGrid, setShowMonthGrid] = useState(false);

  const initialYM = useMemo(() => parseYMD(selectedDate || todayDate), [selectedDate, todayDate]);
  const [viewYear, setViewYear] = useState(initialYM.year);
  const [viewMonth, setViewMonth] = useState(initialYM.month);

  const dayInfoMap = useMemo(() => {
    const map = new Map<string, CalendarDayInfo>();
    for (const d of calendarDays) {
      map.set(d.date, d);
    }
    return map;
  }, [calendarDays]);

  // Quick 7-day strip starting from today (always shows Today + next 6 days)
  const quickStripDays = useMemo(() => calendarDays.slice(0, 7), [calendarDays]);

  // Build month calendar matrix
  const monthCells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const cells: Array<{
      date: string;
      dayNum: number;
      isPast: boolean;
      isToday: boolean;
      info?: CalendarDayInfo;
    } | null> = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toYMD(viewYear, viewMonth, d);
      const isPast = dateStr < todayDate;
      const isToday = dateStr === todayDate;
      cells.push({
        date: dateStr,
        dayNum: d,
        isPast,
        isToday,
        info: dayInfoMap.get(dateStr),
      });
    }
    return cells;
  }, [viewYear, viewMonth, todayDate, dayInfoMap]);

  const monthHeading = useMemo(() => {
    const dt = new Date(Date.UTC(viewYear, viewMonth, 1, 12, 0, 0));
    return dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [viewYear, viewMonth]);

  const canGoPrevMonth = useMemo(() => {
    const todayYM = parseYMD(todayDate);
    return viewYear > todayYM.year || (viewYear === todayYM.year && viewMonth > todayYM.month);
  }, [viewYear, viewMonth, todayDate]);

  const stepMonth = (delta: number) => {
    const dt = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(dt.getUTCFullYear());
    setViewMonth(dt.getUTCMonth());
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
      {/* Header row with Today marker + Full Calendar toggle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <CalendarDays className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="font-semibold text-slate-900 dark:text-white">Select Show Date</span>
          <span className="hidden sm:inline text-slate-400 dark:text-slate-600">·</span>
          <span className="hidden sm:inline font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Today: {todayDate} (IST)
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            const target = parseYMD(selectedDate || todayDate);
            setViewYear(target.year);
            setViewMonth(target.month);
            setShowMonthGrid((prev) => !prev);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-400 hover:text-rose-600 dark:border-white/10 dark:bg-[#151C2E] dark:text-slate-200 dark:hover:border-rose-500/60 dark:hover:text-rose-300 transition-colors cursor-pointer"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {showMonthGrid ? 'Hide Full Calendar' : 'Full Calendar'}
        </button>
      </div>

      {/* Horizontal 7-day Quick Date Strip (Responsive Mobile + Desktop) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickStripDays.map((day) => {
          const { dayName, dayNum, monthName } = formatDateLabel(day.date);
          const isSelected = selectedDate === day.date;
          const isDisabled = !day.hasShows;

          return (
            <button
              key={day.date}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(day.date)}
              title={
                day.hasBookableShows
                  ? `${day.bookableShowCount} bookable show(s) across ${day.theatreCount} theatre(s)`
                  : day.hasShows
                  ? 'All shows for today have started or ended'
                  : 'No shows scheduled on this date'
              }
              className={`relative flex min-w-[78px] flex-1 flex-col items-center rounded-lg border px-3 py-2 text-center transition-all ${
                isSelected
                  ? 'border-rose-600 bg-rose-600 text-white shadow-xs cursor-pointer'
                  : isDisabled
                  ? 'border-slate-200/70 bg-slate-100/70 text-slate-400 cursor-not-allowed dark:border-white/[0.04] dark:bg-white/[0.02] dark:text-slate-600'
                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-rose-400 hover:bg-rose-50/70 cursor-pointer dark:border-white/10 dark:bg-[#151C2E] dark:text-slate-200 dark:hover:border-rose-500/60 dark:hover:bg-rose-600/10'
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isSelected
                    ? 'text-rose-100'
                    : day.isToday
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {day.isToday ? 'Today' : dayName}
              </span>
              <span className="mt-0.5 font-mono text-base font-bold tabular-nums leading-tight">
                {dayNum}
              </span>
              <span
                className={`text-[10px] ${
                  isSelected ? 'text-rose-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {monthName}
              </span>
              <span
                className={`mt-1 text-[10px] font-mono tabular-nums ${
                  isSelected
                    ? 'text-white/90'
                    : day.hasBookableShows
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                {day.hasBookableShows
                  ? `${day.bookableShowCount} shows`
                  : day.hasShows
                  ? 'Closed'
                  : 'No shows'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expandable Full Month Calendar Grid */}
      {showMonthGrid && (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/[0.08]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              disabled={!canGoPrevMonth}
              onClick={() => stepMonth(-1)}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {monthHeading}
            </span>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }
              const isSelected = selectedDate === cell.date;
              const hasShows = Boolean(cell.info?.hasShows);
              const hasBookable = Boolean(cell.info?.hasBookableShows);
              const disabled = cell.isPast || !hasShows;

              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelectDate(cell.date);
                    setShowMonthGrid(false);
                  }}
                  title={
                    cell.isPast
                      ? 'Past date — booking closed'
                      : hasBookable
                      ? `${cell.info?.bookableShowCount} bookable show(s)`
                      : hasShows
                      ? 'All shows for this date have started/ended'
                      : 'No shows scheduled'
                  }
                  className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-xs font-mono tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-rose-600 font-bold text-white cursor-pointer'
                      : cell.isPast
                      ? 'text-slate-300 line-through cursor-not-allowed dark:text-slate-700'
                      : !hasShows
                      ? 'text-slate-400 bg-slate-50/70 cursor-not-allowed dark:bg-white/[0.02] dark:text-slate-600'
                      : cell.isToday
                      ? 'border border-rose-500 bg-rose-50 font-bold text-rose-700 hover:bg-rose-100 cursor-pointer dark:bg-rose-600/15 dark:text-rose-300'
                      : 'border border-slate-200 bg-white font-semibold text-slate-900 hover:border-rose-400 hover:bg-rose-50 cursor-pointer dark:border-white/10 dark:bg-[#151C2E] dark:text-white dark:hover:border-rose-500/60'
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {!cell.isPast && hasBookable && (
                    <span
                      className={`mt-0.5 h-1 w-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-2.5 text-[11px] text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Shows available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded border border-rose-500 bg-rose-500/20" />
              Today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="line-through text-slate-400 dark:text-slate-600">12</span>
              Past / Unavailable
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
