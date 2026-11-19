import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Star, Ticket } from 'lucide-react';
import type { AppView, CalendarDayInfo, Movie, ShowItem } from '../types/cinebook';
import type { LiveServerClockState } from '../hooks/useServerClock';
import { api, formatDuration, formatTime12h, showStartEpochMsIST } from '../lib/api';
import { PosterArtwork } from './PosterArtwork';
import { BookingCalendar } from './BookingCalendar';

interface MovieDetailsViewProps {
  movieId: number;
  cities: string[];
  selectedCity: string;
  serverClock: LiveServerClockState;
  onCityChange: (city: string) => void;
  onNavigate: (view: AppView) => void;
}

export function MovieDetailsView({
  movieId,
  cities,
  selectedCity,
  serverClock,
  onCityChange,
  onNavigate,
}: MovieDetailsViewProps) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDayInfo[]>([]);
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showUnavailableToggle, setShowUnavailableToggle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showsLoading, setShowsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showtimesSectionRef = useRef<HTMLElement | null>(null);

  const activeCity = selectedCity === 'ALL' ? cities[0] || 'Bengaluru' : selectedCity;

  // Fetch movie details + 21-day calendar metadata whenever movie or city changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedDate('');
    Promise.all([api.getMovie(movieId), api.getMovieCalendar(movieId, activeCity, 21)])
      .then(([mRes, calRes]) => {
        if (!active) return;
        setMovie(mRes.movie);
        setCalendarDays(calRes.calendar);
        const defaultDate = calRes.firstBookableDate || calRes.todayDate;
        setSelectedDate(defaultDate);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load movie details and schedule.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [movieId, activeCity]);

  // Fetch live showtimes for selected city & date whenever date changes
  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    setShowsLoading(true);
    api
      .getShows({ movieId, city: activeCity, date: selectedDate })
      .then((res) => {
        if (!active) return;
        setShows(res.shows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load showtimes for this date.');
      })
      .finally(() => {
        if (active) setShowsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [movieId, activeCity, selectedDate]);

  // Re-evaluate show bookability live against serverClock.nowMs every second (zero page refresh needed!)
  const liveEvaluatedShows = useMemo(() => {
    return shows.map((s) => {
      const remaining =
        s.available_seats !== undefined
          ? s.available_seats
          : Math.max(0, (s.total_seats || 64) - (s.booked_count || 0));
      const startEpoch = showStartEpochMsIST(s.show_date, s.show_time);
      const isCancelled = s.status === 'CANCELLED' || s.booking_status === 'CANCELLED';
      const hasStarted = serverClock.nowMs >= startEpoch;
      const isPastDate = s.show_date < serverClock.todayDate;
      const isSoldOut = remaining <= 0;

      let liveStatus = s.booking_status || 'OPEN';
      if (isCancelled) liveStatus = 'CANCELLED';
      else if (isPastDate) liveStatus = 'PAST_DATE';
      else if (hasStarted) {
        liveStatus = s.booking_status === 'COMPLETED' ? 'COMPLETED' : 'STARTED';
      } else if (isSoldOut) liveStatus = 'SOLD_OUT';
      else liveStatus = 'OPEN';

      const liveBookable = liveStatus === 'OPEN' && s.is_bookable !== false;
      return {
        ...s,
        available_seats: remaining,
        booking_status: liveStatus,
        is_bookable: liveBookable,
      };
    });
  }, [shows, serverClock.nowMs, serverClock.todayDate]);

  const visibleShows = useMemo(() => {
    if (showUnavailableToggle) return liveEvaluatedShows;
    return liveEvaluatedShows.filter((s) => s.is_bookable);
  }, [liveEvaluatedShows, showUnavailableToggle]);

  const hiddenExpiredCount = useMemo(
    () => liveEvaluatedShows.filter((s) => !s.is_bookable).length,
    [liveEvaluatedShows]
  );

  // Deduplicated grouping by theatre (only theatres with visible shows on this date)
  const showsByTheatre = useMemo(() => {
    const grouped = new Map<
      number,
      {
        theatreName: string;
        location: string;
        address: string;
        city: string;
        amenities: string;
        shows: ShowItem[];
      }
    >();
    for (const s of visibleShows) {
      if (selectedDate && s.show_date !== selectedDate) continue;
      const existing = grouped.get(s.theatre_id);
      if (existing) {
        existing.shows.push(s);
      } else {
        grouped.set(s.theatre_id, {
          theatreName: s.theatre_name,
          location: s.theatre_location || s.theatre_city,
          address: s.theatre_address,
          city: s.theatre_city,
          amenities: s.theatre_amenities || 'Dolby Atmos',
          shows: [s],
        });
      }
    }
    return Array.from(grouped.entries());
  }, [visibleShows, selectedDate]);

  const nextBookableDate = useMemo(() => {
    return calendarDays.find((d) => d.date > selectedDate && d.hasBookableShows)?.date || null;
  }, [calendarDays, selectedDate]);

  if (loading && !movie) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-80 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-slate-700 dark:text-slate-300">{error || 'Movie not found.'}</p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'movies' })}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
        >
          Back to Movies
        </button>
      </div>
    );
  }

  const hasActiveShows =
    (movie.active_show_count ?? 0) > 0 || calendarDays.some((d) => d.hasBookableShows);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'movies' })}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Movies
      </button>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/35 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Movie Detail Split Layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start pb-12 border-b border-slate-200 dark:border-white/[0.08]">
        <div className="md:col-span-4 lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-white/10 dark:bg-[#101522] aspect-[2/3]">
            <PosterArtwork
              title={movie.title}
              posterUrl={movie.poster_url}
              language={movie.language}
              genre={movie.genre}
              director={movie.director}
              releaseDate={movie.release_date}
              certificate={movie.certificate}
            />
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-rose-600 dark:text-rose-400">{movie.language}</span>
            <span aria-hidden="true">·</span>
            <span>{movie.genre}</span>
            <span aria-hidden="true">·</span>
            <span>{movie.certificate}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{formatDuration(movie.duration_minutes)}</span>
          </div>

          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl lg:text-5xl [text-wrap:balance]">
            {movie.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
            {movie.rating !== null && movie.rating !== undefined && (
              <span className="inline-flex items-center gap-1.5 font-mono text-base font-semibold text-slate-900 dark:text-white tabular-nums">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {movie.rating.toFixed(1)} / 10
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              Release Date: {movie.release_date}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              {movie.status === 'NOW_SHOWING' && hasActiveShows ? 'Now Showing in Theatres' : 'Upcoming Release'}
            </span>
          </div>

          <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-700 dark:text-slate-300">
            {movie.description}
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 dark:border-white/[0.08] pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Director</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{movie.director}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Cast</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{movie.cast_members}</dd>
            </div>
          </dl>

          {hasActiveShows && (
            <div className="mt-7">
              <button
                type="button"
                onClick={() =>
                  showtimesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors cursor-pointer"
              >
                <Ticket className="h-4 w-4" />
                Book Tickets
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Calendar, City & Real-Time Theatre Showtime Selection */}
      <section ref={showtimesSectionRef} className="pt-10 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Select Date, Theatre &amp; Showtime
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Live schedules synced to {serverClock.timezone} ({serverClock.formattedDate} ·{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {serverClock.time12}
              </span>
              ). Past &amp; started shows are automatically disabled.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" />
              <select
                aria-label="Filter theatres by city"
                value={activeCity}
                onChange={(e) => onCityChange(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#101522] dark:text-white"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {hiddenExpiredCount > 0 && (
              <button
                type="button"
                onClick={() => setShowUnavailableToggle((prev) => !prev)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-[#101522] dark:text-slate-300 dark:hover:text-white cursor-pointer"
              >
                {showUnavailableToggle
                  ? 'Hide Started / Closed Shows'
                  : `Show ${hiddenExpiredCount} Earlier / Closed Show(s)`}
              </button>
            )}
          </div>
        </div>

        {/* Interactive Calendar Strip + Full Month Picker */}
        {calendarDays.length > 0 && (
          <BookingCalendar
            todayDate={serverClock.todayDate}
            selectedDate={selectedDate || serverClock.todayDate}
            calendarDays={calendarDays}
            onSelectDate={setSelectedDate}
          />
        )}

        {/* Theatre & Showtime Listing */}
        {showsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
            ))}
          </div>
        ) : movie.status === 'UPCOMING' && liveEvaluatedShows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/[0.08] dark:bg-[#101522]">
            <p className="text-base font-medium text-slate-900 dark:text-white">
              Theatrical bookings open closer to {movie.release_date}.
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Administrators can schedule preview shows for this film anytime from the Admin Dashboard.
            </p>
          </div>
        ) : showsByTheatre.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/[0.08] dark:bg-[#101522]">
            <p className="text-base font-medium text-slate-900 dark:text-white">
              {hiddenExpiredCount > 0
                ? `All scheduled shows for ${selectedDate} in ${activeCity} have already started or ended.`
                : `No screenings scheduled in ${activeCity} for ${selectedDate}.`}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Select another upcoming date on the calendar or switch cities to view available theatres.
            </p>
            {nextBookableDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(nextBookableDate)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5" />
                Jump to Next Available Date ({nextBookableDate})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {showsByTheatre.length} theatre{showsByTheatre.length === 1 ? '' : 's'} in{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{activeCity}</span> for{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {selectedDate}
              </span>
            </div>

            {showsByTheatre.map(([theatreId, group]) => (
              <div
                key={theatreId}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:p-6"
              >
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                      {group.theatreName}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {group.address}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {group.amenities}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {group.location}, {group.city}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {group.shows.map((s) => {
                    const remaining = s.available_seats ?? 0;
                    const total = s.total_seats || 64;
                    const isOpen = Boolean(s.is_bookable);
                    const statusLabel =
                      s.booking_status === 'STARTED'
                        ? 'Show Started'
                        : s.booking_status === 'COMPLETED'
                        ? 'Show Ended'
                        : s.booking_status === 'SOLD_OUT'
                        ? 'Housefull'
                        : s.booking_status === 'CANCELLED'
                        ? 'Cancelled'
                        : s.booking_status === 'PAST_DATE'
                        ? 'Booking Closed'
                        : `${remaining}/${total} seats`;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!isOpen}
                        onClick={() => isOpen && onNavigate({ name: 'seats', showId: s.id })}
                        title={
                          isOpen
                            ? `Book ${formatTime12h(s.show_time)} on ${s.screen_name}`
                            : s.booking_block_reason || 'This showtime is unavailable for booking'
                        }
                        className={`group flex flex-col items-start rounded-lg border px-4 py-2.5 text-left transition-colors ${
                          isOpen
                            ? 'border-slate-200 bg-slate-50 hover:border-rose-500 hover:bg-rose-50 dark:border-white/15 dark:bg-[#151C2E] dark:hover:border-rose-500 dark:hover:bg-rose-600/10 cursor-pointer'
                            : 'border-slate-200/70 bg-slate-100/80 opacity-60 cursor-not-allowed dark:border-white/[0.06] dark:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              isOpen
                                ? 'text-slate-900 group-hover:text-rose-600 dark:text-white dark:group-hover:text-rose-300'
                                : 'text-slate-500 line-through dark:text-slate-500'
                            }`}
                          >
                            {formatTime12h(s.show_time)}
                          </span>
                          {s.end_time && (
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                              – {formatTime12h(s.end_time)}
                            </span>
                          )}
                        </div>
                        <span className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                          {s.screen_name} · ₹{s.silver_price}–₹{s.platinum_price}
                        </span>
                        <span
                          className={`mt-0.5 text-[11px] font-mono tabular-nums ${
                            !isOpen
                              ? 'text-rose-600 dark:text-rose-400'
                              : remaining <= 10
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
