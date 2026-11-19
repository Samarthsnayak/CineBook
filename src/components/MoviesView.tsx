import { useEffect, useState } from 'react';
import { Info, Search, X } from 'lucide-react';
import type { AppView, Movie } from '../types/cinebook';
import { api } from '../lib/api';
import { MovieCard } from './MovieCard';

interface MoviesViewProps {
  initialQuery?: string;
  initialStatus?: string;
  initialLanguage?: string;
  onNavigate: (view: AppView) => void;
}

const LANGUAGES = ['ALL', 'Kannada', 'Hindi', 'Tamil', 'Telugu', 'Malayalam'];
const GENRES = ['ALL', 'Action', 'Comedy', 'Drama', 'Thriller', 'Romance', 'Adventure'];

export function MoviesView({
  initialQuery = '',
  initialStatus = 'ALL',
  initialLanguage = 'ALL',
  onNavigate,
}: MoviesViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [language, setLanguage] = useState(initialLanguage);
  const [genre, setGenre] = useState('ALL');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [tmdbConfigured, setTmdbConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setStatus(initialStatus || 'ALL');
  }, [initialStatus]);

  useEffect(() => {
    setLanguage(initialLanguage || 'ALL');
  }, [initialLanguage]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .getMovies({ q: query, status, language, genre })
      .then((res) => {
        if (!active) return;
        setMovies(res.movies);
        setTmdbConfigured(res.tmdbConfigured);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to retrieve movie listings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, status, language, genre]);

  const statusTabs = [
    { id: 'ALL', label: 'All Movies' },
    { id: 'NOW_SHOWING', label: 'Now Showing' },
    { id: 'UPCOMING', label: 'Upcoming' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Indian &amp; Theatrical Movies
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Filter by Kannada, Hindi, Tamil, Telugu, or Malayalam cinema, genre, and title.
          </p>
        </div>

        <div className="relative w-full lg:w-96">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movie by title, cast, or director..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#101522] dark:text-white dark:placeholder:text-slate-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status + Language + Genre Filters */}
      <div className="mb-6 space-y-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatus(tab.id)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  status === tab.id
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Genre Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {GENRES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  genre === g
                    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-600/20 dark:text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-[#101522] dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {g === 'ALL' ? 'All Genres' : g}
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated 5 Indian Languages Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Language:</span>
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                language === lang
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-[#101522] dark:text-slate-300 dark:hover:border-white/25 dark:hover:text-white'
              }`}
            >
              {lang === 'ALL' ? 'All Indian Languages' : lang}
            </button>
          ))}
        </div>
      </div>

      {!tmdbConfigured && !error && (
        <div className="mb-6 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Info className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>
            Verified Indian theatrical catalog active with official posters. Live TMDB sync activates automatically when <code className="font-mono text-slate-800 dark:text-slate-300">TMDB_API_KEY</code> is set on the backend.
          </span>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-8 text-center text-sm text-rose-800 dark:border-rose-500/35 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="aspect-[2/3] animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]"
            />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-white/[0.08] dark:bg-[#101522]">
          <p className="text-slate-700 dark:text-slate-300 font-medium">
            No movies match your current filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setStatus('ALL');
              setLanguage('ALL');
              setGenre('ALL');
            }}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onSelect={(movieId) => onNavigate({ name: 'movie-details', movieId })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
