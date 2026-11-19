import { useState, type FormEvent } from 'react';
import { ArrowRight, Code2, Info, MapPin, Search } from 'lucide-react';
import type { AppView, Movie } from '../types/cinebook';
import { MovieCard } from './MovieCard';

const HERO_IMAGE = '/src/assets/images/hero_cinema_premiere_1795076461577.jpg';
const INDIAN_LANGUAGES = ['ALL', 'Kannada', 'Hindi', 'Tamil', 'Telugu', 'Malayalam'];

interface HomeViewProps {
  movies: Movie[];
  tmdbConfigured: boolean;
  cities: string[];
  selectedCity: string;
  onCityChange: (city: string) => void;
  onNavigate: (view: AppView) => void;
}

export function HomeView({
  movies,
  tmdbConfigured,
  cities,
  selectedCity,
  onCityChange,
  onNavigate,
}: HomeViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [heroError, setHeroError] = useState(false);

  // Strictly distinguish Now Showing (marked NOW_SHOWING AND has active theatrical showtimes)
  const nowShowingAll = movies.filter(
    (m) => m.status === 'NOW_SHOWING' && (m.active_show_count ?? 0) > 0
  );
  const upcomingAll = movies.filter((m) => m.status === 'UPCOMING');

  const nowShowing =
    languageFilter === 'ALL'
      ? nowShowingAll
      : nowShowingAll.filter((m) =>
          m.language.toLowerCase().includes(languageFilter.toLowerCase())
        );

  const upcoming =
    languageFilter === 'ALL'
      ? upcomingAll
      : upcomingAll.filter((m) =>
          m.language.toLowerCase().includes(languageFilter.toLowerCase())
        );

  const featured = nowShowingAll[0];

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    onNavigate({
      name: 'movies',
      initialQuery: searchTerm.trim(),
      initialLanguage: languageFilter !== 'ALL' ? languageFilter : undefined,
    });
  };

  return (
    <div>
      {/* Widescreen Cinema Hero (Atmospheric dark scrim preserves >10:1 legibility in both themes) */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0B0F1A] dark:border-white/[0.08]">
        <div className="absolute inset-0">
          {!heroError ? (
            <img
              src={HERO_IMAGE}
              alt="Luxury cinema auditorium with crimson velvet seats"
              referrerPolicy="no-referrer"
              onError={() => setHeroError(true)}
              className="h-full w-full object-cover object-center opacity-55"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#13192B] via-[#0B0F1A] to-[#080A10]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#080A10]/95 via-[#080A10]/85 to-[#080A10]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080A10]/90 via-transparent to-[#080A10]/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span>Kannada · Hindi · Tamil · Telugu · Malayalam</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-400 font-medium">Instant QR Digital Tickets</span>
            </div>

            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl [text-wrap:balance]">
              Reserve the Best Seat in the House.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200">
              Discover Indian theatrical releases across {cities.length} cities, pick your exact Silver, Gold, or Platinum seats in real time, and confirm instant QR passes.
            </p>

            {/* Integrated Search & City Selector Bar */}
            <form
              onSubmit={handleSearch}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Indian movies by title, cast, or director..."
                  className="w-full rounded-lg border border-white/20 bg-[#0E1422]/90 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="relative sm:w-44">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" />
                <select
                  aria-label="Select city"
                  value={selectedCity}
                  onChange={(e) => onCityChange(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-white/20 bg-[#0E1422]/90 py-3 pl-9 pr-8 text-sm font-medium text-white focus:border-rose-500 focus:outline-none"
                >
                  <option value="ALL">All Cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Find Movies
              </button>
            </form>

            {featured && (
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                <span className="text-slate-400">Now booking:</span>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'movie-details', movieId: featured.id })}
                  className="inline-flex items-center gap-1.5 font-medium text-white hover:text-rose-400 transition-colors cursor-pointer"
                >
                  {featured.title} ({featured.language})
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Now Showing Section with Indian Language Filters */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              Now Showing
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Verified theatrical screenings with open showtimes
              {selectedCity !== 'ALL' ? ` in ${selectedCity}` : ' across partner theatres'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
              {INDIAN_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguageFilter(lang)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    languageFilter === lang
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {lang === 'ALL' ? 'All Languages' : lang}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate({
                  name: 'movies',
                  initialStatus: 'NOW_SHOWING',
                  initialLanguage: languageFilter !== 'ALL' ? languageFilter : undefined,
                })
              }
              className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              Explore all
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!tmdbConfigured && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-white/[0.08] dark:bg-[#101522] dark:text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>
              Showing verified Indian cinema listings with authentic official posters across Kannada, Hindi, Tamil, Telugu, and Malayalam. Configure <code className="font-mono text-slate-900 dark:text-slate-200">TMDB_API_KEY</code> on the server and click <strong className="text-slate-900 dark:text-slate-200">Sync TMDB</strong> in Admin Dashboard to also pull live TMDB discoveries and ratings.
            </span>
          </div>
        )}

        {nowShowing.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 dark:border-white/[0.08] dark:bg-[#101522] dark:text-slate-400">
            No {languageFilter} movies have active showtimes right now. Switch languages or schedule shows from the Admin Dashboard.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {nowShowing.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onSelect={(movieId) => onNavigate({ name: 'movie-details', movieId })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Movies */}
      <section className="border-t border-slate-200 bg-slate-100/70 dark:border-white/[0.06] dark:bg-[#0B0F19] transition-colors duration-200">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Upcoming Movies
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Announced Indian theatrical releases — advance bookings open once theatres publish showtimes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'movies', initialStatus: 'UPCOMING' })}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors self-start sm:self-auto cursor-pointer"
            >
              View upcoming slate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 dark:border-white/[0.08] dark:bg-[#101522] dark:text-slate-400">
              No upcoming {languageFilter} releases listed yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onSelect={(movieId) => onNavigate({ name: 'movie-details', movieId })}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Java Spring Boot + MySQL Source Bundle Callout */}
      <section className="border-t border-slate-200 dark:border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:flex-row sm:items-center sm:p-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Complete Java 17 Spring Boot + MySQL + Thymeleaf Maven Project
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                Includes Spring Security session auth, backend TMDB integration, idempotent transactional booking checkout, MySQL 9-table schema, and downloadable Maven ZIP.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate({ name: 'java-source' })}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:border-white/30 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Code2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Browse Java Project
              </button>
              <a
                href="/api/java-project/download"
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors whitespace-nowrap"
              >
                Download Maven ZIP
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
