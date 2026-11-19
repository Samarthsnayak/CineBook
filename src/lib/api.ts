import type {
  AdminPosterMovie,
  AdminStats,
  BookingRecord,
  CalendarDayInfo,
  CityRecord,
  Movie,
  PosterStorageInfo,
  Screen,
  SeatSlot,
  ServerClock,
  ShowBookingStatus,
  ShowItem,
  Theatre,
  User,
} from '../types/cinebook';

const AUTH_TOKEN_KEY = 'cinebook_session_token';

export function getStoredAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage access restrictions if any
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && url !== '/api/auth/login') {
      if (!url.startsWith('/api/admin')) {
        setStoredAuthToken(null);
      }
    }
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Real-time Server Clock
  getServerTime: (timezone = 'Asia/Kolkata') =>
    apiFetch<{ serverClock: ServerClock }>(`/api/time?timezone=${encodeURIComponent(timezone)}`),

  // Auth
  me: () => apiFetch<{ user: User | null }>('/api/auth/me'),
  login: async (email: string, password: string) => {
    const res = await apiFetch<{ user: User; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) setStoredAuthToken(res.token);
    return res;
  },
  register: async (payload: { name: string; email: string; phone: string; password: string }) => {
    const res = await apiFetch<{ user: User; token?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) setStoredAuthToken(res.token);
    return res;
  },
  logout: async () => {
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredAuthToken(null);
    }
  },
  updateProfile: (payload: { name: string; phone: string }) =>
    apiFetch<{ user: User; message: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Catalog, Calendar & Discovery
  getMovies: (params?: { q?: string; status?: string; genre?: string; language?: string }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.status && params.status !== 'ALL') sp.set('status', params.status);
    if (params?.genre && params.genre !== 'ALL') sp.set('genre', params.genre);
    if (params?.language && params.language !== 'ALL') sp.set('language', params.language);
    const qs = sp.toString();
    return apiFetch<{ movies: Movie[]; tmdbConfigured: boolean }>(`/api/movies${qs ? `?${qs}` : ''}`);
  },
  getMovie: (id: number) =>
    apiFetch<{ movie: Movie; tmdbConfigured: boolean }>(`/api/movies/${id}`),
  getMovieCalendar: (movieId: number, city?: string, days = 21) => {
    const sp = new URLSearchParams();
    if (city && city !== 'ALL') sp.set('city', city);
    sp.set('days', String(days));
    return apiFetch<{
      serverClock: ServerClock;
      todayDate: string;
      firstBookableDate: string;
      calendar: CalendarDayInfo[];
    }>(`/api/movies/${movieId}/calendar?${sp.toString()}`);
  },
  getCities: () => apiFetch<{ cities: string[]; cityRecords: CityRecord[] }>('/api/cities'),
  getTheatres: (city?: string) =>
    apiFetch<{ theatres: Theatre[] }>(
      `/api/theatres${city && city !== 'ALL' ? `?city=${encodeURIComponent(city)}` : ''}`
    ),
  getShows: (params: {
    movieId?: number;
    theatreId?: number;
    city?: string;
    date?: string;
    onlyBookable?: boolean;
    includeCancelled?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params.movieId) sp.set('movieId', String(params.movieId));
    if (params.theatreId) sp.set('theatreId', String(params.theatreId));
    if (params.city && params.city !== 'ALL') sp.set('city', params.city);
    if (params.date && params.date !== 'ALL') sp.set('date', params.date);
    if (params.onlyBookable) sp.set('onlyBookable', 'true');
    if (params.includeCancelled) sp.set('includeCancelled', 'true');
    return apiFetch<{ shows: ShowItem[]; availableDates: string[]; serverClock: ServerClock }>(
      `/api/shows?${sp.toString()}`
    );
  },
  getShowSeats: (showId: number) =>
    apiFetch<{
      show: ShowItem;
      seats: SeatSlot[];
      serverClock: ServerClock;
      isBookable: boolean;
      bookingStatus: ShowBookingStatus;
      bookingBlockReason: string | null;
    }>(`/api/shows/${showId}/seats`),

  // Bookings (DB-backed)
  checkout: (payload: {
    showId: number;
    seatIds: number[];
    paymentMethod: 'UPI' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'NET_BANKING';
    paymentDetails: string;
    simulateFailure?: boolean;
    idempotencyKey?: string;
  }) =>
    apiFetch<{ booking: BookingRecord; message?: string; duplicatePrevented?: boolean }>(
      '/api/bookings/checkout',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  getMyBookings: () => apiFetch<{ bookings: BookingRecord[] }>('/api/bookings/my'),
  getBookingByRef: (ref: string) =>
    apiFetch<{ booking: BookingRecord }>(`/api/bookings/${encodeURIComponent(ref)}`),
  cancelBooking: (id: number) =>
    apiFetch<{ booking: BookingRecord; message: string }>(`/api/bookings/${id}/cancel`, {
      method: 'POST',
    }),

  // Admin Overview, Posters & TMDB Sync
  getAdminOverview: () =>
    apiFetch<{
      tmdbConfigured: boolean;
      posterStorage: PosterStorageInfo;
      serverClock: ServerClock;
      stats: AdminStats;
      cities: CityRecord[];
      bookings: BookingRecord[];
      users: User[];
      screens: Screen[];
    }>('/api/admin/overview'),
  getAdminPosters: () =>
    apiFetch<{
      storage: PosterStorageInfo;
      maxUploadBytes: number;
      movies: AdminPosterMovie[];
    }>('/api/admin/posters'),
  uploadMoviePoster: (movieId: number, file: File) => {
    const formData = new FormData();
    formData.append('poster', file);
    return apiFetch<{
      movie: Movie;
      posterUrl: string;
      message: string;
    }>(`/api/admin/movies/${movieId}/poster`, {
      method: 'POST',
      body: formData,
    });
  },
  deleteMoviePoster: (movieId: number) =>
    apiFetch<{ movie: Movie; message: string }>(`/api/admin/movies/${movieId}/poster`, {
      method: 'DELETE',
    }),
  syncTmdb: () =>
    apiFetch<{ syncedCount: number; languagesSynced: string[]; message: string }>(
      '/api/admin/tmdb/sync',
      { method: 'POST' }
    ),

  // Admin Movies CRUD
  createMovie: (payload: Partial<Movie>) =>
    apiFetch<{ movie: Movie }>('/api/admin/movies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMovie: (id: number, payload: Partial<Movie>) =>
    apiFetch<{ movie: Movie }>(`/api/admin/movies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMovie: (id: number) =>
    apiFetch<{ deleted: boolean }>(`/api/admin/movies/${id}`, { method: 'DELETE' }),

  // Admin Cities CRUD
  getAdminCities: () => apiFetch<{ cities: CityRecord[] }>('/api/admin/cities'),
  createCity: (payload: { name: string; state?: string; timezone?: string }) =>
    apiFetch<{ city: CityRecord; message: string }>('/api/admin/cities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCity: (id: number, payload: { name?: string; state?: string; timezone?: string }) =>
    apiFetch<{ city: CityRecord; message: string }>(`/api/admin/cities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteCity: (id: number) =>
    apiFetch<{ deleted: boolean; message: string }>(`/api/admin/cities/${id}`, {
      method: 'DELETE',
    }),

  // Admin Theatres & Screens CRUD
  createTheatre: (payload: {
    name: string;
    city: string;
    location?: string;
    address: string;
    amenities: string;
    timezone?: string;
    initial_seats?: number;
  }) =>
    apiFetch<{ id: number; theatre: Theatre; message: string }>('/api/admin/theatres', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTheatre: (
    id: number,
    payload: {
      name?: string;
      city?: string;
      location?: string;
      address?: string;
      amenities?: string;
      timezone?: string;
    }
  ) =>
    apiFetch<{ theatre: Theatre; message: string }>(`/api/admin/theatres/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteTheatre: (id: number) =>
    apiFetch<{ deleted: boolean; message: string }>(`/api/admin/theatres/${id}`, {
      method: 'DELETE',
    }),
  createScreen: (payload: {
    theatre_id: number;
    name: string;
    format: string;
    screen_number?: number;
    total_seats?: number;
  }) =>
    apiFetch<{ id: number; screen: Screen; message: string }>('/api/admin/screens', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateScreen: (
    id: number,
    payload: { name?: string; format?: string; screen_number?: number }
  ) =>
    apiFetch<{ screen: Screen; message: string }>(`/api/admin/screens/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteScreen: (id: number) =>
    apiFetch<{ deleted: boolean; message: string }>(`/api/admin/screens/${id}`, {
      method: 'DELETE',
    }),

  // Admin Shows CRUD & Status Control
  getAdminShows: (params?: { date?: string; city?: string; movieId?: number }) => {
    const sp = new URLSearchParams();
    if (params?.date && params.date !== 'ALL') sp.set('date', params.date);
    if (params?.city && params.city !== 'ALL') sp.set('city', params.city);
    if (params?.movieId) sp.set('movieId', String(params.movieId));
    const qs = sp.toString();
    return apiFetch<{ shows: ShowItem[]; serverClock: ServerClock }>(
      `/api/admin/shows${qs ? `?${qs}` : ''}`
    );
  },
  createShow: (payload: {
    movie_id: number;
    screen_id: number;
    show_date: string;
    show_time: string;
    end_time?: string;
    silver_price: number;
    gold_price: number;
    platinum_price: number;
  }) =>
    apiFetch<{ id: number; end_time: string; message: string }>('/api/admin/shows', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateShow: (
    id: number,
    payload: {
      movie_id?: number;
      screen_id?: number;
      show_date?: string;
      show_time?: string;
      end_time?: string;
      silver_price?: number;
      gold_price?: number;
      platinum_price?: number;
      status?: 'ACTIVE' | 'CANCELLED';
    }
  ) =>
    apiFetch<{ id: number; message: string }>(`/api/admin/shows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  setShowStatus: (id: number, status: 'ACTIVE' | 'CANCELLED') =>
    apiFetch<{ id: number; status: 'ACTIVE' | 'CANCELLED'; message: string }>(
      `/api/admin/shows/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    ),
  deleteShow: (id: number) =>
    apiFetch<{ deleted: boolean; message: string }>(`/api/admin/shows/${id}`, { method: 'DELETE' }),

  // Java Source Explorer
  getJavaProjectFiles: () =>
    apiFetch<{ files: Array<{ path: string; isBinary: boolean; size: number }> }>('/api/java-project/files'),
  getJavaProjectFile: (filePath: string) =>
    apiFetch<{ path: string; content: string }>(
      `/api/java-project/file?path=${encodeURIComponent(filePath)}`
    ),
};

export function calculatePricing(seats: Array<{ price: number }>) {
  const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
  const convenienceFee = seats.length * 30;
  const taxAmount = Math.round(convenienceFee * 0.18 * 100) / 100;
  const totalAmount = Math.round((subtotal + convenienceFee + taxAmount) * 100) / 100;
  return { subtotal, convenienceFee, taxAmount, totalAmount };
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24 || '';
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}

export function formatDateLabel(dateStr: string): { dayName: string; dayNum: string; monthName: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  return {
    dayName: dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
    dayNum: String(d || 1).padStart(2, '0'),
    monthName: dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
  };
}

export function formatBookingTimestamp(isoOrSql: string): string {
  if (!isoOrSql) return '';
  const normalized = isoOrSql.includes('T') ? isoOrSql : isoOrSql.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return isoOrSql;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Evaluates a show's epoch start time in Asia/Kolkata (UTC+05:30) client-side so UI buttons
 * lock instantly the exact second a show starts, even before the next API refresh.
 */
export function showStartEpochMsIST(showDate: string, showTime: string): number {
  const [y, m, d] = showDate.split('-').map(Number);
  const [h, min] = showTime.split(':').map(Number);
  const utcMs = Date.UTC(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0);
  return utcMs - (5 * 60 + 30) * 60 * 1000;
}
