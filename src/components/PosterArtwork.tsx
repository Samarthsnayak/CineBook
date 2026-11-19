import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';

interface PosterArtworkProps {
  title: string;
  posterUrl?: string | null;
  language?: string;
  genre?: string;
  director?: string;
  releaseDate?: string;
  certificate?: string;
  compact?: boolean;
  className?: string;
}

const LANGUAGE_ACCENTS: Record<string, string> = {
  Kannada: 'from-[#2A1219] via-[#131828] to-[#0A0D16]',
  Hindi: 'from-[#28141E] via-[#141A2C] to-[#090C14]',
  Tamil: 'from-[#24121B] via-[#101829] to-[#090C16]',
  Telugu: 'from-[#2B1418] via-[#151A2A] to-[#0A0D16]',
  Malayalam: 'from-[#171F2E] via-[#121726] to-[#090C14]',
};

export function PosterArtwork({
  title,
  posterUrl,
  language = 'Indian Cinema',
  genre = '',
  director = '',
  releaseDate = '',
  certificate = 'UA',
  compact = false,
  className = '',
}: PosterArtworkProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setIsLandscape(false);
  }, [posterUrl]);

  if (posterUrl && !failed) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-200 dark:bg-[#151C2E]">
        {!loaded && (
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-[#192238]"
          />
        )}
        {isLandscape && (
          <img
            src={posterUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-50"
          />
        )}
        <img
          src={posterUrl}
          alt={`${title} official movie poster`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setIsLandscape(img.naturalWidth / img.naturalHeight > 1.25);
            }
            setLoaded(true);
          }}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
          className={`relative h-full w-full transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${isLandscape ? 'object-contain p-1.5' : 'object-cover object-top'} ${className}`}
        />
      </div>
    );
  }

  const grad = LANGUAGE_ACCENTS[language] || 'from-[#24131D] via-[#121828] to-[#090C14]';
  const year = releaseDate ? releaseDate.slice(0, 4) : '';

  if (compact) {
    return (
      <div
        className={`flex h-full w-full flex-col justify-between bg-gradient-to-br ${grad} p-2.5 text-left border border-slate-200 dark:border-white/10 ${className}`}
      >
        <div className="flex items-center justify-between text-[9px] font-mono text-rose-400">
          <span>{language}</span>
          <span>{certificate}</span>
        </div>
        <div className="font-display text-xs font-bold leading-tight text-white line-clamp-3">
          {title}
        </div>
        <div className="text-[9px] font-mono text-slate-400">{year}</div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between bg-gradient-to-br ${grad} p-5 text-left ${className}`}
    >
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-300/90">
        <span className="text-rose-400 font-semibold">{language}</span>
        <span>{certificate}</span>
      </div>

      <div className="my-auto py-4">
        <Film className="mb-3 h-5 w-5 text-rose-500/80" />
        <h4 className="font-display text-2xl font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
          {title}
        </h4>
        {genre && <p className="mt-2 text-xs text-slate-300/80">{genre}</p>}
      </div>

      <div className="border-t border-white/10 pt-3">
        {director && (
          <div className="text-[11px] text-slate-400 truncate">
            Directed by <span className="text-slate-200">{director}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>{year ? `Theatrical ${year}` : 'Theatrical Release'}</span>
          <span>CineBook</span>
        </div>
      </div>
    </div>
  );
}
