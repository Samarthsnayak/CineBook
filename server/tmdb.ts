import { db } from './db.ts';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const INDIAN_LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'kn', name: 'Kannada' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
];

interface TmdbListItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  original_language: string;
}

interface TmdbDetailResponse {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: Array<{ id: number; name: string }>;
  credits?: {
    cast: Array<{ name: string }>;
    crew: Array<{ name: string; job: string }>;
  };
}

export function isTmdbConfigured(): boolean {
  const key = process.env.TMDB_API_KEY?.trim();
  return Boolean(key && key.length > 8 && key !== 'YOUR_TMDB_API_KEY');
}

async function fetchTmdbJson<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is not configured in environment variables.');
  }
  const isBearerToken = apiKey.startsWith('eyJ') || apiKey.length > 60;
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = isBearerToken
    ? `${TMDB_BASE}${endpoint}`
    : `${TMDB_BASE}${endpoint}${sep}api_key=${encodeURIComponent(apiKey)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (isBearerToken) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`TMDB API returned HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function syncIndianMoviesFromTmdb(): Promise<{
  syncedCount: number;
  languagesSynced: string[];
}> {
  if (!isTmdbConfigured()) {
    throw new Error(
      'TMDB API key is not configured on the server. Set TMDB_API_KEY in your environment variables to sync live theatrical movies and official posters.'
    );
  }

  const upsertStmt = db.prepare(`
    INSERT INTO movies (
      tmdb_id, title, description, cast_members, director, genre, language,
      duration_minutes, rating, certificate, release_date, status, poster_url, data_source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UA', ?, ?, ?, 'TMDB')
    ON CONFLICT(tmdb_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      cast_members = excluded.cast_members,
      director = excluded.director,
      genre = excluded.genre,
      language = excluded.language,
      duration_minutes = excluded.duration_minutes,
      rating = excluded.rating,
      release_date = excluded.release_date,
      poster_url = CASE
        WHEN COALESCE(movies.poster_managed_by_admin, 0) = 1 THEN movies.poster_url
        WHEN excluded.poster_url != '' THEN excluded.poster_url
        ELSE movies.poster_url
      END,
      data_source = 'TMDB'
  `);

  let syncedCount = 0;
  const languagesSynced: string[] = [];

  // 1. Hydrate any existing catalog movies that have a verified TMDB ID (respecting admin-uploaded posters)
  const existingWithTmdb = db
    .prepare('SELECT id, tmdb_id, poster_url, COALESCE(poster_managed_by_admin, 0) AS poster_managed_by_admin FROM movies WHERE tmdb_id IS NOT NULL')
    .all() as Array<{ id: number; tmdb_id: number; poster_url: string; poster_managed_by_admin: number }>;

  for (const row of existingWithTmdb) {
    try {
      const details = await fetchTmdbJson<TmdbDetailResponse>(`/movie/${row.tmdb_id}`);
      const rating =
        details.vote_average && details.vote_average > 0
          ? Math.round(details.vote_average * 10) / 10
          : null;
      if (row.poster_managed_by_admin === 1) {
        if (rating !== null) {
          db.prepare('UPDATE movies SET rating = COALESCE(?, rating) WHERE id = ?').run(rating, row.id);
        }
        continue;
      }
      if (details.poster_path) {
        const posterUrl = `${TMDB_IMAGE_BASE}${details.poster_path}`;
        db.prepare(
          'UPDATE movies SET poster_url = ?, rating = COALESCE(?, rating) WHERE id = ?'
        ).run(posterUrl, rating, row.id);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`TMDB hydrate warning for tmdb_id=${row.tmdb_id}:`, err instanceof Error ? err.message : err);
    }
  }

  // 2. Discover current popular theatrical releases across Kannada, Hindi, Tamil, Telugu, and Malayalam
  for (const lang of INDIAN_LANGUAGES) {
    try {
      const nowPlaying = await fetchTmdbJson<{ results: TmdbListItem[] }>(
        `/discover/movie?region=IN&with_original_language=${lang.code}&with_release_type=3|2&sort_by=popularity.desc&page=1`
      );
      const topItems = (nowPlaying.results || []).slice(0, 3);
      if (topItems.length > 0) languagesSynced.push(lang.name);

      for (const item of topItems) {
        if (!item.title || !item.overview) continue;
        const details = await fetchTmdbJson<TmdbDetailResponse>(
          `/movie/${item.id}?append_to_response=credits`
        );
        const director =
          details.credits?.crew?.find((c) => c.job === 'Director')?.name || 'Director TBA';
        const cast =
          details.credits?.cast
            ?.slice(0, 4)
            .map((c) => c.name)
            .join(', ') || 'Cast TBA';
        const genre =
          details.genres?.map((g) => g.name).slice(0, 2).join(' / ') || 'Drama';
        const posterUrl = details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : '';
        const today = new Date().toISOString().slice(0, 10);
        const releaseDate = details.release_date || today;
        const status = releaseDate > today ? 'UPCOMING' : 'NOW_SHOWING';
        const rating = details.vote_average && details.vote_average > 0
          ? Math.round(details.vote_average * 10) / 10
          : null;

        upsertStmt.run(
          details.id,
          details.title,
          details.overview,
          cast,
          director,
          genre,
          lang.name,
          details.runtime || 140,
          rating,
          releaseDate,
          status,
          posterUrl
        );
        syncedCount++;
      }
    } catch (err) {
      console.warn(`TMDB sync warning for ${lang.name}:`, err instanceof Error ? err.message : err);
    }
  }

  return { syncedCount, languagesSynced };
}
