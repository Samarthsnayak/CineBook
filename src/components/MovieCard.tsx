import { Star } from 'lucide-react';
import type { Movie } from '../types/cinebook';
import { formatDuration } from '../lib/api';
import { PosterArtwork } from './PosterArtwork';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movieId: number) => void;
}

export function MovieCard({ movie, onSelect }: MovieCardProps) {
  const isNowShowing = movie.status === 'NOW_SHOWING' && (movie.active_show_count ?? 1) > 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.04] transition-all duration-200 hover:-translate-y-1 hover:border-rose-400 hover:shadow-md dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none dark:hover:border-rose-500/40">
      <button
        type="button"
        onClick={() => onSelect(movie.id)}
        className="relative aspect-[2/3] w-full overflow-hidden bg-slate-200 dark:bg-[#151C2E] text-left cursor-pointer focus-visible:outline-none"
      >
        <PosterArtwork
          title={movie.title}
          posterUrl={movie.poster_url}
          language={movie.language}
          genre={movie.genre}
          director={movie.director}
          releaseDate={movie.release_date}
          certificate={movie.certificate}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {movie.poster_url && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs font-medium text-white">
              {movie.rating !== null && movie.rating !== undefined ? (
                <span className="inline-flex items-center gap-1 font-mono tabular-nums drop-shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {movie.rating.toFixed(1)}/10
                </span>
              ) : (
                <span className="font-mono text-slate-200 drop-shadow-sm">{movie.language}</span>
              )}
              <span className="rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-slate-100 font-mono tabular-nums backdrop-blur-xs">
                {movie.certificate}
              </span>
            </div>
          </>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 truncate">
          <span className="font-semibold text-rose-600 dark:text-rose-400">{movie.language}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{movie.genre}</span>
        </div>

        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white leading-snug line-clamp-1 mb-1">
          {movie.title}
        </h3>

        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          <span>{formatDuration(movie.duration_minutes)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {movie.rating !== null && movie.rating !== undefined
              ? `★ ${movie.rating.toFixed(1)}/10`
              : movie.release_date}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onSelect(movie.id)}
          className={`mt-auto w-full rounded-lg py-2.5 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            isNowShowing
              ? 'bg-rose-600 text-white hover:bg-rose-700 dark:hover:bg-rose-500'
              : 'border border-slate-300 bg-slate-50 text-slate-800 hover:border-slate-400 hover:bg-slate-100 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/[0.07]'
          }`}
        >
          {isNowShowing ? 'Book Tickets' : 'View Details'}
        </button>
      </div>
    </article>
  );
}
