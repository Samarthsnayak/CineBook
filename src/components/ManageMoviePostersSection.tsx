import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  HardDrive,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AdminPosterMovie, PosterStorageInfo } from '../types/cinebook';
import { api } from '../lib/api';
import { PosterArtwork } from './PosterArtwork';

interface ManageMoviePostersSectionProps {
  onPosterChanged: () => void;
}

const LANGUAGES = ['ALL', 'Kannada', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'English'];
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|webp)$/i;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ManageMoviePostersSection({ onPosterChanged }: ManageMoviePostersSectionProps) {
  const [movies, setMovies] = useState<AdminPosterMovie[]>([]);
  const [storageInfo, setStorageInfo] = useState<PosterStorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NOW_SHOWING' | 'UPCOMING'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected movie + file waiting for preview confirmation before upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMovieRef = useRef<AdminPosterMovie | null>(null);
  const [previewState, setPreviewState] = useState<{
    movie: AdminPosterMovie;
    file: File;
    objectUrl: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadPosters = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminPosters();
      setMovies(res.movies);
      setStorageInfo(res.storage);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load movie posters.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosters();
  }, []);

  // Revoke temporary preview object URL cleanly on change/unmount (never persisted)
  useEffect(() => {
    return () => {
      if (previewState?.objectUrl) {
        URL.revokeObjectURL(previewState.objectUrl);
      }
    };
  }, [previewState]);

  const filteredMovies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return movies.filter((m) => {
      if (languageFilter !== 'ALL' && m.language.toLowerCase() !== languageFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter !== 'ALL' && m.status !== statusFilter) {
        return false;
      }
      if (q && !m.title.toLowerCase().includes(q) && !m.director.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [movies, searchQuery, languageFilter, statusFilter]);

  const openFilePickerForMovie = (movie: AdminPosterMovie) => {
    setFeedback(null);
    setConfirmRemoveId(null);
    pendingMovieRef.current = movie;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetMovie = pendingMovieRef.current;
    if (!file || !targetMovie) return;

    // Client-side pre-validation (backend also performs strict magic-byte validation)
    if (!ALLOWED_EXTENSIONS.test(file.name) && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      setFeedback({
        type: 'error',
        text: `Unsupported file "${file.name}". Please select a JPG, JPEG, PNG, or WEBP image.`,
      });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setFeedback({
        type: 'error',
        text: `"${file.name}" is ${formatBytes(file.size)}. Maximum allowed poster size is 5 MB.`,
      });
      return;
    }

    if (file.size < 64) {
      setFeedback({
        type: 'error',
        text: `"${file.name}" appears empty or corrupted. Please choose another image.`,
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewState({ movie: targetMovie, file, objectUrl });
  };

  const closePreviewModal = () => {
    if (uploading) return;
    setPreviewState(null);
  };

  const handleConfirmUpload = async () => {
    if (!previewState) return;
    setUploading(true);
    setFeedback(null);
    try {
      const res = await api.uploadMoviePoster(previewState.movie.id, previewState.file);
      setFeedback({
        type: 'success',
        text: `Poster updated for "${previewState.movie.title}". ${res.message}`,
      });
      setPreviewState(null);
      await loadPosters();
      onPosterChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Poster upload failed. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePoster = async (movie: AdminPosterMovie) => {
    setRemovingId(movie.id);
    setFeedback(null);
    try {
      await api.deleteMoviePoster(movie.id);
      setConfirmRemoveId(null);
      setFeedback({
        type: 'success',
        text: `Removed poster for "${movie.title}". You can upload a new poster at any time.`,
      });
      await loadPosters();
      onPosterChanged();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to remove movie poster.',
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden native local file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={handleFileSelected}
        className="hidden"
        aria-hidden="true"
      />

      {/* Header & Storage Info Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Manage Movie Posters
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Upload, replace, or remove official movie posters directly from your computer (JPG, JPEG, PNG, WEBP up to 5 MB). Changes update immediately across all CineBook pages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {storageInfo && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                {storageInfo.provider === 'GCS' ? (
                  <Cloud className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                ) : (
                  <HardDrive className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="font-medium">{storageInfo.label}</span>
              </div>
            )}
            <button
              type="button"
              onClick={loadPosters}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/30 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search & Language / Status Filters */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 dark:border-white/[0.08] md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies by title or director..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear movie search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              aria-label="Filter movies by language"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'ALL' ? 'All Languages' : lang}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'NOW_SHOWING' | 'UPCOMING')}
              aria-label="Filter movies by status"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            >
              <option value="ALL">All Releases ({movies.length})</option>
              <option value="NOW_SHOWING">Now Showing</option>
              <option value="UPCOMING">Upcoming</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/35 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="text-current opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Movies Poster Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[420px] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-white/[0.08] dark:bg-[#101522]"
            />
          ))}
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-white/[0.08] dark:bg-[#101522]">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No movies match your search or language filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setLanguageFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMovies.map((movie) => {
            const hasPoster = Boolean(movie.poster_url && movie.poster_url.trim().length > 0);
            const isCustomUpload = Boolean(movie.poster_storage_key || movie.poster_storage_provider);
            const isConfirmingRemove = confirmRemoveId === movie.id;
            const isRemoving = removingId === movie.id;

            return (
              <div
                key={movie.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none"
              >
                {/* Poster Preview */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100 dark:bg-[#151C2E]">
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

                {/* Movie Details & Poster Controls */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="font-display text-base font-bold leading-snug text-slate-900 dark:text-white line-clamp-1">
                      {movie.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {movie.language}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{movie.status === 'NOW_SHOWING' ? 'Now Showing' : 'Upcoming'}</span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {!hasPoster ? (
                        <span className="text-amber-700 dark:text-amber-400">No poster set</span>
                      ) : isCustomUpload ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Admin Uploaded
                          {movie.poster_byte_size ? ` · ${formatBytes(movie.poster_byte_size)}` : ''}
                        </span>
                      ) : (
                        <span>Default Official Poster</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => openFilePickerForMovie(movie)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors cursor-pointer"
                    >
                      {hasPoster ? (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          Change Poster
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-3.5 w-3.5" />
                          Upload Poster
                        </>
                      )}
                    </button>

                    {hasPoster && !isConfirmingRemove && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(movie.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove Poster
                      </button>
                    )}

                    {hasPoster && isConfirmingRemove && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isRemoving}
                          onClick={() => handleRemovePoster(movie)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isRemoving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Confirm Remove'
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isRemoving}
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pre-Upload Preview & Confirmation Modal */}
      {previewState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="poster-upload-modal-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#101522]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/[0.08]">
              <div>
                <h3
                  id="poster-upload-modal-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  Confirm Poster Upload
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {previewState.movie.title} · {previewState.movie.language}
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={closePreviewModal}
                aria-label="Close preview modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white cursor-pointer disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Current Poster
                </div>
                <div className="aspect-[2/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-[#151C2E]">
                  <PosterArtwork
                    title={previewState.movie.title}
                    posterUrl={previewState.movie.poster_url}
                    language={previewState.movie.language}
                    genre={previewState.movie.genre}
                    director={previewState.movie.director}
                    releaseDate={previewState.movie.release_date}
                    certificate={previewState.movie.certificate}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  New Selected Poster
                </div>
                <div className="aspect-[2/3] overflow-hidden rounded-xl border-2 border-rose-500 bg-slate-100 dark:bg-[#151C2E]">
                  <img
                    src={previewState.objectUrl}
                    alt={`Preview of new poster for ${previewState.movie.title}`}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="mt-2.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="truncate font-medium text-slate-900 dark:text-white">
                    {previewState.file.name}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums">
                    {previewState.file.type || 'Image'} · {formatBytes(previewState.file.size)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/[0.08] dark:bg-[#0A0E17]">
              <button
                type="button"
                disabled={uploading}
                onClick={() => openFilePickerForMovie(previewState.movie)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer disabled:opacity-40"
              >
                Choose a different file
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={closePreviewModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleConfirmUpload}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading Poster...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Confirm Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
