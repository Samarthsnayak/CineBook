import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Monitor } from 'lucide-react';
import type { AppView, ShowItem, Theatre } from '../types/cinebook';
import type { LiveServerClockState } from '../hooks/useServerClock';
import { api, formatDateLabel, formatTime12h, showStartEpochMsIST } from '../lib/api';

interface TheatresViewProps {
  cities: string[];
  selectedCity: string;
  serverClock: LiveServerClockState;
  onCityChange: (city: string) => void;
  onNavigate: (view: AppView) => void;
}

export function TheatresView({
  cities,
  selectedCity,
  serverClock,
  onCityChange,
  onNavigate,
}: TheatresViewProps) {
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(serverClock.todayDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getTheatres(selectedCity),
      api.getShows({ city: selectedCity, date: selectedDate, onlyBookable: true }),
    ])
      .then(([tRes, sRes]) => {
        if (!active) return;
        setTheatres(tRes.theatres);
        setShows(sRes.shows);
        if (sRes.availableDates && sRes.availableDates.length > 0) {
          setAvailableDates(sRes.availableDates);
          if (!selectedDate) setSelectedDate(sRes.availableDates[0]);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load theatres right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCity, selectedDate]);

  // Filter live against serverClock so shows that just started vanish from bookable buttons instantly
  const liveBookableShows = useMemo(() => {
    return shows.filter((s) => {
      if (!s.is_bookable) return false;
      const startEpoch = showStartEpochMsIST(s.show_date, s.show_time);
      return startEpoch > serverClock.nowMs;
    });
  }, [shows, serverClock.nowMs]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Theatres &amp; Live Schedules
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Explore theatres across Indian cities and book upcoming showtimes synced to live IST ({serverClock.time12}).
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <button
            type="button"
            onClick={() => onCityChange('ALL')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              selectedCity === 'ALL'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All Cities
          </button>
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCityChange(c)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCity === c
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Date Filter Bar */}
      {availableDates.length > 0 && (
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0 mr-1">
            <Calendar className="h-3.5 w-3.5 text-rose-500" />
            Date:
          </span>
          {availableDates.map((d) => {
            const { dayName, dayNum, monthName } = formatDateLabel(d);
            const isSelected = selectedDate === d;
            const isToday = d === serverClock.todayDate;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-rose-400 dark:border-white/10 dark:bg-[#101522] dark:text-slate-300 dark:hover:border-rose-500/60'
                }`}
              >
                {isToday ? 'Today' : dayName}, {dayNum} {monthName}
              </button>
            );
          })}
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-8 text-center text-sm text-rose-800 dark:border-rose-500/35 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
          ))}
        </div>
      ) : theatres.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 dark:border-white/[0.08] dark:bg-[#101522] dark:text-slate-400">
          No theatres found in {selectedCity}. Try selecting another city.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Showing {theatres.length} theatre{theatres.length === 1 ? '' : 's'}
            {selectedCity !== 'ALL' ? ` in ${selectedCity}` : ' across all cities'} · Date:{' '}
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {selectedDate}
            </span>
          </div>

          {theatres.map((theatre) => {
            const theatreShows = liveBookableShows.filter((s) => s.theatre_id === theatre.id);

            return (
              <div
                key={theatre.id}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 dark:border-white/[0.06] pb-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {theatre.location && theatre.location !== theatre.city
                        ? `${theatre.location}, ${theatre.city}`
                        : theatre.city}
                    </div>
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      {theatre.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{theatre.address}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{theatre.amenities}</p>
                  </div>

                  {theatre.screens && theatre.screens.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-300">
                      {theatre.screens.map((sc) => (
                        <span
                          key={sc.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-white/10 dark:bg-[#151C2E]"
                        >
                          <Monitor className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                          {sc.name} ({sc.total_seats} seats)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {theatreShows.length > 0 ? (
                  <div className="mt-4">
                    <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-rose-500" />
                      Upcoming Bookable Showtimes ({theatreShows.length})
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {theatreShows.map((s) => {
                        const avail =
                          s.available_seats ?? Math.max(0, (s.total_seats || 64) - (s.booked_count || 0));
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => onNavigate({ name: 'seats', showId: s.id })}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-left transition-colors hover:border-rose-500 hover:bg-rose-50 dark:border-white/12 dark:bg-[#151C2E] dark:hover:border-rose-500 dark:hover:bg-rose-600/10 cursor-pointer"
                          >
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              {s.movie_title}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                              {formatTime12h(s.show_time)}
                              {s.end_time ? ` – ${formatTime12h(s.end_time)}` : ''} · ₹{s.silver_price}+
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {s.screen_name} · {avail} seats open
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    No remaining bookable showtimes for {selectedDate} at this theatre. Select tomorrow&apos;s date above to view upcoming shows.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
