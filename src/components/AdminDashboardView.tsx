import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  Film,
  ImagePlus,
  IndianRupee,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AdminStats,
  AdminTab,
  AppView,
  BookingRecord,
  CityRecord,
  Movie,
  Screen,
  ShowItem,
  Theatre,
  User,
} from '../types/cinebook';
import type { LiveServerClockState } from '../hooks/useServerClock';
import { api, formatTime12h } from '../lib/api';
import { LoginView } from './AuthViews';
import { ManageMoviePostersSection } from './ManageMoviePostersSection';

interface AdminDashboardViewProps {
  user: User | null;
  initialTab?: AdminTab;
  serverClock: LiveServerClockState;
  onAuthSuccess: (user: User, redirectAfter?: AppView) => void;
  onNavigate: (view: AppView) => void;
  onCatalogUpdated: () => void;
}

const LANGUAGES = ['Kannada', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'English'];
const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York'];

export function AdminDashboardView({
  user,
  initialTab = 'movies',
  serverClock,
  onAuthSuccess,
  onNavigate,
  onCatalogUpdated,
}: AdminDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [tmdbConfigured, setTmdbConfigured] = useState(false);
  const [syncingTmdb, setSyncingTmdb] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cities, setCities] = useState<CityRecord[]>([]);
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [theatreCityFilter, setTheatreCityFilter] = useState<string>('ALL');
  const [showCityFilter, setShowCityFilter] = useState<string>('ALL');
  const [showDateFilter, setShowDateFilter] = useState<string>('ALL');
  const [showMovieFilter, setShowMovieFilter] = useState<string>('ALL');

  // Movie Form
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);
  const [movieForm, setMovieForm] = useState({
    title: '',
    description: '',
    cast_members: '',
    director: '',
    genre: 'Action / Drama',
    language: 'Kannada',
    duration_minutes: 150,
    rating: '',
    certificate: 'UA',
    release_date: serverClock.todayDate,
    status: 'NOW_SHOWING' as 'NOW_SHOWING' | 'UPCOMING',
    poster_url: '',
  });

  // City Form
  const [editingCityId, setEditingCityId] = useState<number | null>(null);
  const [cityForm, setCityForm] = useState({
    name: '',
    state: '',
    timezone: 'Asia/Kolkata',
  });

  // Theatre & Screen Forms
  const [editingTheatreId, setEditingTheatreId] = useState<number | null>(null);
  const [theatreForm, setTheatreForm] = useState({
    name: '',
    city: 'Bengaluru',
    location: '',
    address: '',
    amenities: 'Dolby Atmos · 4K Laser · Recliners · M-Ticket',
    timezone: 'Asia/Kolkata',
    initial_seats: 64,
  });
  const [screenForm, setScreenForm] = useState({
    theatre_id: 0,
    name: 'Screen 3 · Gold',
    format: 'Dolby Atmos',
    total_seats: 64,
  });

  // Show Form
  const [editingShowId, setEditingShowId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState({
    movie_id: 0,
    screen_id: 0,
    show_date: serverClock.todayDate,
    show_time: '19:30',
    end_time: '',
    silver_price: 220,
    gold_price: 340,
    platinum_price: 520,
  });

  const loadAll = async () => {
    try {
      const [overview, mRes, tRes, sRes] = await Promise.all([
        api.getAdminOverview(),
        api.getMovies(),
        api.getTheatres(),
        api.getAdminShows(),
      ]);
      setTmdbConfigured(overview.tmdbConfigured);
      setStats(overview.stats);
      setCities(overview.cities || []);
      setBookings(overview.bookings);
      setUsers(overview.users);
      setScreens(overview.screens);
      setMovies(mRes.movies);
      setTheatres(tRes.theatres);
      setShows(sRes.shows);

      setShowForm((prev) => ({
        ...prev,
        movie_id: prev.movie_id || mRes.movies[0]?.id || 0,
        screen_id: prev.screen_id || overview.screens[0]?.id || 0,
      }));
      setScreenForm((prev) => ({
        ...prev,
        theatre_id: prev.theatre_id || tRes.theatres[0]?.id || 0,
      }));
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load admin data.',
      });
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadAll();
    }
  }, [user]);

  const filteredTheatres = useMemo(() => {
    if (theatreCityFilter === 'ALL') return theatres;
    return theatres.filter((t) => t.city.toLowerCase() === theatreCityFilter.toLowerCase());
  }, [theatres, theatreCityFilter]);

  const uniqueShowDates = useMemo(() => {
    return Array.from(new Set(shows.map((s) => s.show_date))).sort();
  }, [shows]);

  const filteredShows = useMemo(() => {
    return shows.filter((s) => {
      if (showCityFilter !== 'ALL' && s.theatre_city.toLowerCase() !== showCityFilter.toLowerCase()) {
        return false;
      }
      if (showDateFilter !== 'ALL' && s.show_date !== showDateFilter) return false;
      if (showMovieFilter !== 'ALL' && String(s.movie_id) !== showMovieFilter) return false;
      return true;
    });
  }, [shows, showCityFilter, showDateFilter, showMovieFilter]);

  if (!user) {
    return (
      <LoginView
        adminMode
        redirectAfter={{ name: 'admin', initialTab }}
        onAuthSuccess={onAuthSuccess}
        onNavigate={onNavigate}
      />
    );
  }

  if (user.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 dark:text-white">
            Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your account ({user.email}) has standard user privileges. Movie catalog, theatre, schedule, and poster management are restricted to authenticated administrators.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'home' })}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
            >
              Return to Home
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate({ name: 'login', adminMode: true, redirectAfter: { name: 'admin', initialTab } })
              }
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer"
            >
              Sign In as Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Handlers: TMDB & Movies ----
  const handleSyncTmdb = async () => {
    setFeedback(null);
    setSyncingTmdb(true);
    try {
      const res = await api.syncTmdb();
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'TMDB sync failed.' });
    } finally {
      setSyncingTmdb(false);
    }
  };

  const handleSaveMovie = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const payload: Partial<Movie> = {
      ...movieForm,
      rating: movieForm.rating.trim() ? Number(movieForm.rating) : null,
    };
    try {
      if (editingMovieId) {
        await api.updateMovie(editingMovieId, payload);
        setFeedback({ type: 'success', text: `Updated "${movieForm.title}" successfully.` });
      } else {
        await api.createMovie(payload);
        setFeedback({ type: 'success', text: `Added "${movieForm.title}" to catalog.` });
      }
      setEditingMovieId(null);
      setMovieForm({
        title: '',
        description: '',
        cast_members: '',
        director: '',
        genre: 'Action / Drama',
        language: 'Kannada',
        duration_minutes: 150,
        rating: '',
        certificate: 'UA',
        release_date: serverClock.todayDate,
        status: 'NOW_SHOWING',
        poster_url: '',
      });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save movie.' });
    }
  };

  const handleEditMovie = (m: Movie) => {
    setEditingMovieId(m.id);
    setMovieForm({
      title: m.title,
      description: m.description,
      cast_members: m.cast_members,
      director: m.director,
      genre: m.genre,
      language: m.language,
      duration_minutes: m.duration_minutes,
      rating: m.rating !== null && m.rating !== undefined ? String(m.rating) : '',
      certificate: m.certificate,
      release_date: m.release_date,
      status: m.status,
      poster_url: m.poster_url || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMovie = async (id: number, title: string) => {
    setFeedback(null);
    try {
      await api.deleteMovie(id);
      setFeedback({ type: 'success', text: `Deleted "${title}" from catalog.` });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete movie.' });
    }
  };

  // ---- Handlers: Cities ----
  const handleSaveCity = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      if (editingCityId) {
        const res = await api.updateCity(editingCityId, cityForm);
        setFeedback({ type: 'success', text: res.message });
      } else {
        const res = await api.createCity(cityForm);
        setFeedback({ type: 'success', text: res.message });
      }
      setEditingCityId(null);
      setCityForm({ name: '', state: '', timezone: 'Asia/Kolkata' });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save city.' });
    }
  };

  const handleDeleteCity = async (c: CityRecord) => {
    setFeedback(null);
    try {
      const res = await api.deleteCity(c.id);
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete city.' });
    }
  };

  // ---- Handlers: Theatres & Screens ----
  const handleSaveTheatre = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      if (editingTheatreId) {
        const res = await api.updateTheatre(editingTheatreId, {
          name: theatreForm.name,
          city: theatreForm.city,
          location: theatreForm.location,
          address: theatreForm.address,
          amenities: theatreForm.amenities,
          timezone: theatreForm.timezone,
        });
        setFeedback({ type: 'success', text: res.message });
      } else {
        const res = await api.createTheatre(theatreForm);
        setFeedback({ type: 'success', text: res.message });
      }
      setEditingTheatreId(null);
      setTheatreForm({
        name: '',
        city: cities[0]?.name || 'Bengaluru',
        location: '',
        address: '',
        amenities: 'Dolby Atmos · 4K Laser · Recliners · M-Ticket',
        timezone: 'Asia/Kolkata',
        initial_seats: 64,
      });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save theatre.' });
    }
  };

  const handleEditTheatre = (t: Theatre) => {
    setEditingTheatreId(t.id);
    setTheatreForm({
      name: t.name,
      city: t.city,
      location: t.location || '',
      address: t.address,
      amenities: t.amenities,
      timezone: t.timezone || 'Asia/Kolkata',
      initial_seats: 64,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTheatre = async (t: Theatre) => {
    setFeedback(null);
    try {
      const res = await api.deleteTheatre(t.id);
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete theatre.' });
    }
  };

  const handleAddScreen = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await api.createScreen(screenForm);
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add screen.' });
    }
  };

  const handleDeleteScreen = async (sc: Screen) => {
    setFeedback(null);
    try {
      const res = await api.deleteScreen(sc.id);
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete screen.' });
    }
  };

  // ---- Handlers: Dynamic Show Schedules ----
  const handleSaveShow = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const payload = {
        movie_id: showForm.movie_id,
        screen_id: showForm.screen_id,
        show_date: showForm.show_date,
        show_time: showForm.show_time,
        end_time: showForm.end_time.trim() || undefined,
        silver_price: showForm.silver_price,
        gold_price: showForm.gold_price,
        platinum_price: showForm.platinum_price,
      };
      if (editingShowId) {
        const res = await api.updateShow(editingShowId, payload);
        setFeedback({ type: 'success', text: res.message });
      } else {
        const res = await api.createShow(payload);
        setFeedback({
          type: 'success',
          text: `${res.message} (Ends ${formatTime12h(res.end_time)}).`,
        });
      }
      setEditingShowId(null);
      setShowForm((prev) => ({ ...prev, end_time: '' }));
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save show.' });
    }
  };

  const handleEditShow = (s: ShowItem) => {
    setEditingShowId(s.id);
    setShowForm({
      movie_id: s.movie_id,
      screen_id: s.screen_id,
      show_date: s.show_date,
      show_time: s.show_time,
      end_time: s.end_time || '',
      silver_price: s.silver_price,
      gold_price: s.gold_price,
      platinum_price: s.platinum_price,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleShowStatus = async (s: ShowItem) => {
    setFeedback(null);
    const nextStatus = s.status === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
    try {
      const res = await api.setShowStatus(s.id, nextStatus);
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update show status.' });
    }
  };

  const handleDeleteShow = async (id: number) => {
    setFeedback(null);
    try {
      const res = await api.deleteShow(id);
      setFeedback({ type: 'success', text: res.message });
      await loadAll();
      onCatalogUpdated();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete show.' });
    }
  };

  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'movies', label: `Movies (${movies.length})` },
    { id: 'posters', label: 'Manage Movie Posters' },
    { id: 'cities', label: `Cities (${cities.length})` },
    { id: 'theatres', label: `Theatres & Screens (${theatres.length})` },
    { id: 'shows', label: `Showtimes (${shows.length})` },
    { id: 'bookings', label: `Bookings (${bookings.length})` },
    { id: 'users', label: `Users (${users.length})` },
  ];

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white dark:placeholder:text-slate-500';
  const inputSmClass =
    'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white dark:placeholder:text-slate-500';
  const cardClass =
    'rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage movies, posters, cities, theatres, screen capacities, live show schedules ({serverClock.formattedDate} · {serverClock.time12} IST), and bookings.
          </p>
        </div>

        <button
          type="button"
          disabled={syncingTmdb}
          onClick={handleSyncTmdb}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:border-rose-400 dark:border-white/15 dark:bg-[#101522] dark:text-white dark:hover:border-rose-500/60 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-rose-600 dark:text-rose-400 ${syncingTmdb ? 'animate-spin' : ''}`} />
          {syncingTmdb
            ? 'Syncing TMDB...'
            : tmdbConfigured
            ? 'Sync Live Indian Movies (TMDB)'
            : 'Sync TMDB (Requires TMDB_API_KEY)'}
        </button>
      </div>

      {/* KPI Strip */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Confirmed Revenue</span>
              <IndianRupee className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              ₹{stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {stats.seatsSold} active seats sold
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Confirmed Bookings</span>
              <Ticket className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.confirmedBookings}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {stats.cancelledBookings} cancelled
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Cities &amp; Theatres</span>
              <Building2 className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.totalCities ?? cities.length} / {stats.totalTheatres}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {stats.totalShows} active scheduled shows
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Movies &amp; Users</span>
              <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {stats.totalMovies} / {stats.totalUsers}
            </div>
            <div className="mt-1 text-xs text-slate-500">Catalog titles &amp; registered accounts</div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/35 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-8 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t.id === 'posters' && <ImagePlus className="h-3.5 w-3.5" />}
            {t.id === 'cities' && <MapPin className="h-3.5 w-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: MANAGE MOVIE POSTERS */}
      {activeTab === 'posters' && (
        <ManageMoviePostersSection
          onPosterChanged={() => {
            loadAll();
            onCatalogUpdated();
          }}
        />
      )}

      {/* TAB: MOVIES CRUD */}
      {activeTab === 'movies' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form onSubmit={handleSaveMovie} className={`lg:col-span-5 ${cardClass} p-6 space-y-3.5 h-fit`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingMovieId ? 'Edit Movie' : 'Add Movie Manually'}
              </h2>
              {editingMovieId && (
                <button
                  type="button"
                  onClick={() => setEditingMovieId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Official Movie Title"
              required
              value={movieForm.title}
              onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={movieForm.language}
                onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })}
                className={inputClass}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Genre (e.g. Action / Thriller)"
                required
                value={movieForm.genre}
                onChange={(e) => setMovieForm({ ...movieForm, genre: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Director"
                required
                value={movieForm.director}
                onChange={(e) => setMovieForm({ ...movieForm, director: e.target.value })}
                className={inputClass}
              />
              <input
                type="number"
                min={60}
                max={300}
                placeholder="Duration (mins)"
                required
                value={movieForm.duration_minutes}
                onChange={(e) =>
                  setMovieForm({ ...movieForm, duration_minutes: Number(e.target.value) })
                }
                className={inputClass}
              />
            </div>
            <input
              type="text"
              placeholder="Cast Members (comma separated)"
              required
              value={movieForm.cast_members}
              onChange={(e) => setMovieForm({ ...movieForm, cast_members: e.target.value })}
              className={inputClass}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                step="0.1"
                min={1}
                max={10}
                placeholder="Rating (opt)"
                value={movieForm.rating}
                onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })}
                className={inputSmClass}
              />
              <input
                type="date"
                value={movieForm.release_date}
                onChange={(e) => setMovieForm({ ...movieForm, release_date: e.target.value })}
                className={inputSmClass}
              />
              <select
                value={movieForm.status}
                onChange={(e) =>
                  setMovieForm({
                    ...movieForm,
                    status: e.target.value as 'NOW_SHOWING' | 'UPCOMING',
                  })
                }
                className={inputSmClass}
              >
                <option value="NOW_SHOWING">Now Showing</option>
                <option value="UPCOMING">Upcoming</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Official Poster URL (https://... or /posters/...)"
              value={movieForm.poster_url}
              onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })}
              className={inputSmClass}
            />
            <textarea
              rows={3}
              placeholder="Movie Synopsis"
              required
              value={movieForm.description}
              onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
              className={inputClass}
            />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {editingMovieId ? 'Update Movie' : 'Add Movie'}
            </button>
          </form>

          <div className={`lg:col-span-7 ${cardClass} p-6 overflow-x-auto`}>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">
              Movie Catalog
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Language</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Active Shows</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {movies.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 pr-3 font-medium text-slate-900 dark:text-white">{m.title}</td>
                    <td className="py-3 pr-3 text-rose-600 dark:text-rose-400 font-medium">{m.language}</td>
                    <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                      {m.status === 'NOW_SHOWING' ? 'Now Showing' : 'Upcoming'}
                    </td>
                    <td className="py-3 pr-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {m.active_show_count ?? 0}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEditMovie(m)}
                        className="mr-2 inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/30 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMovie(m.id, m.title)}
                        className="inline-flex items-center gap-1 rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-600/15 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: CITIES CRUD */}
      {activeTab === 'cities' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form onSubmit={handleSaveCity} className={`lg:col-span-5 ${cardClass} p-6 space-y-3.5 h-fit`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingCityId ? 'Edit City' : 'Add New City'}
              </h2>
              {editingCityId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCityId(null);
                    setCityForm({ name: '', state: '', timezone: 'Asia/Kolkata' });
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">City Name</label>
              <input
                type="text"
                placeholder="e.g. Pune, Kolkata, Ahmedabad"
                required
                value={cityForm.name}
                onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">State / Region</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                value={cityForm.state}
                onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Timezone</label>
              <select
                value={cityForm.timezone}
                onChange={(e) => setCityForm({ ...cityForm, timezone: e.target.value })}
                className={inputClass}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {editingCityId ? 'Update City' : 'Add City'}
            </button>
          </form>

          <div className={`lg:col-span-7 ${cardClass} p-6 overflow-x-auto`}>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">
              Active Cities ({cities.length})
            </h2>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">City</th>
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3 font-medium">Timezone</th>
                  <th className="pb-3 font-medium">Theatres</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {cities.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                    <td className="py-3 pr-3 text-slate-600 dark:text-slate-400">{c.state || '—'}</td>
                    <td className="py-3 pr-3 font-mono text-slate-700 dark:text-slate-300">{c.timezone}</td>
                    <td className="py-3 pr-3 font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {c.theatre_count ?? 0}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCityId(c.id);
                          setCityForm({ name: c.name, state: c.state || '', timezone: c.timezone || 'Asia/Kolkata' });
                        }}
                        className="mr-2 inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400 dark:border-white/15 dark:text-slate-200 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCity(c)}
                        className="inline-flex items-center gap-1 rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: THEATRES & SCREENS */}
      {activeTab === 'theatres' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleSaveTheatre} className={`${cardClass} p-6 space-y-3.5`}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {editingTheatreId ? 'Edit Theatre' : 'Add Theatre'}
                </h2>
                {editingTheatreId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTheatreId(null);
                      setTheatreForm({
                        name: '',
                        city: cities[0]?.name || 'Bengaluru',
                        location: '',
                        address: '',
                        amenities: 'Dolby Atmos · 4K Laser · Recliners · M-Ticket',
                        timezone: 'Asia/Kolkata',
                        initial_seats: 64,
                      });
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Theatre Name"
                required
                value={theatreForm.name}
                onChange={(e) => setTheatreForm({ ...theatreForm, name: e.target.value })}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={theatreForm.city}
                  onChange={(e) => setTheatreForm({ ...theatreForm, city: e.target.value })}
                  className={inputClass}
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Area / Locality (e.g. Indiranagar)"
                  value={theatreForm.location}
                  onChange={(e) => setTheatreForm({ ...theatreForm, location: e.target.value })}
                  className={inputClass}
                />
              </div>
              <input
                type="text"
                placeholder="Full Street Address"
                required
                value={theatreForm.address}
                onChange={(e) => setTheatreForm({ ...theatreForm, address: e.target.value })}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Facilities / Amenities"
                value={theatreForm.amenities}
                onChange={(e) => setTheatreForm({ ...theatreForm, amenities: e.target.value })}
                className={inputSmClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
                    Timezone
                  </label>
                  <select
                    value={theatreForm.timezone}
                    onChange={(e) => setTheatreForm({ ...theatreForm, timezone: e.target.value })}
                    className={inputSmClass}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                {!editingTheatreId && (
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
                      Screen 1 Seat Capacity (24–160)
                    </label>
                    <input
                      type="number"
                      min={24}
                      max={160}
                      step={8}
                      value={theatreForm.initial_seats}
                      onChange={(e) =>
                        setTheatreForm({ ...theatreForm, initial_seats: Number(e.target.value) })
                      }
                      className={`${inputSmClass} font-mono`}
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
              >
                {editingTheatreId
                  ? 'Update Theatre Details'
                  : `Create Theatre + Screen 1 (${theatreForm.initial_seats} Seats)`}
              </button>
            </form>

            <form onSubmit={handleAddScreen} className={`${cardClass} p-6 space-y-3.5`}>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Add Screen to Theatre
              </h2>
              <select
                value={screenForm.theatre_id}
                onChange={(e) => setScreenForm({ ...screenForm, theatre_id: Number(e.target.value) })}
                className={inputSmClass}
              >
                {theatres.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.city} — {t.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Screen Name (e.g. Screen 3 · IMAX)"
                required
                value={screenForm.name}
                onChange={(e) => setScreenForm({ ...screenForm, name: e.target.value })}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Format (IMAX 2D / Dolby Atmos)"
                  required
                  value={screenForm.format}
                  onChange={(e) => setScreenForm({ ...screenForm, format: e.target.value })}
                  className={inputSmClass}
                />
                <input
                  type="number"
                  min={24}
                  max={160}
                  step={8}
                  placeholder="Total Seats"
                  required
                  value={screenForm.total_seats}
                  onChange={(e) => setScreenForm({ ...screenForm, total_seats: Number(e.target.value) })}
                  className={`${inputSmClass} font-mono`}
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 text-sm font-semibold text-slate-800 hover:border-slate-400 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:border-white/30 cursor-pointer"
              >
                Add Screen ({screenForm.total_seats} Auto-Generated Seats)
              </button>
            </form>
          </div>

          <div className={`lg:col-span-7 ${cardClass} p-6`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Registered Theatres &amp; Screens ({filteredTheatres.length})
              </h2>
              <select
                aria-label="Filter theatres by city"
                value={theatreCityFilter}
                onChange={(e) => setTheatreCityFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
              >
                <option value="ALL">All Cities ({theatres.length})</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.theatre_count ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3.5 max-h-[760px] overflow-y-auto pr-1">
              {filteredTheatres.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.07] dark:bg-[#151C2E]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{t.name}</div>
                      <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {t.location ? `${t.location}, ` : ''}
                        {t.city} · {t.address}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{t.amenities}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditTheatre(t)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-slate-400 dark:border-white/15 dark:bg-[#0D121F] dark:text-slate-200 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTheatre(t)}
                        className="inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-300">
                    {t.screens?.map((sc) => (
                      <span
                        key={sc.id}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-[#0D121F]"
                      >
                        <span>
                          {sc.name} ({sc.format}) · {sc.total_seats} seats
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteScreen(sc)}
                          title={`Delete ${sc.name}`}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: DYNAMIC SHOW SCHEDULES */}
      {activeTab === 'shows' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form onSubmit={handleSaveShow} className={`lg:col-span-4 ${cardClass} p-6 space-y-3.5 h-fit`}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingShowId ? 'Edit Showtime' : 'Schedule Showtime'}
              </h2>
              {editingShowId && (
                <button
                  type="button"
                  onClick={() => setEditingShowId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Automatically rejects past dates/times and overlapping schedules on the same screen.
            </p>
            <div>
              <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Movie</label>
              <select
                value={showForm.movie_id}
                onChange={(e) => setShowForm({ ...showForm, movie_id: Number(e.target.value) })}
                className={inputSmClass}
              >
                {movies.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.language} · {m.duration_minutes}m)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
                Theatre &amp; Screen
              </label>
              <select
                value={showForm.screen_id}
                onChange={(e) => setShowForm({ ...showForm, screen_id: Number(e.target.value) })}
                className={inputSmClass}
              >
                {screens.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.theatre_city} — {sc.theatre_name} ({sc.name}, {sc.total_seats} seats)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Show Date</label>
              <input
                type="date"
                min={serverClock.todayDate}
                value={showForm.show_date}
                onChange={(e) => setShowForm({ ...showForm, show_date: e.target.value })}
                required
                className={inputSmClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Start Time</label>
                <input
                  type="time"
                  value={showForm.show_time}
                  onChange={(e) => setShowForm({ ...showForm, show_time: e.target.value })}
                  required
                  className={inputSmClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
                  End Time (Auto if blank)
                </label>
                <input
                  type="time"
                  value={showForm.end_time}
                  onChange={(e) => setShowForm({ ...showForm, end_time: e.target.value })}
                  className={inputSmClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600 dark:text-slate-400">Silver (₹)</label>
                <input
                  type="number"
                  min={50}
                  value={showForm.silver_price}
                  onChange={(e) => setShowForm({ ...showForm, silver_price: Number(e.target.value) })}
                  className={`${inputSmClass} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-600 dark:text-slate-400">Gold (₹)</label>
                <input
                  type="number"
                  min={50}
                  value={showForm.gold_price}
                  onChange={(e) => setShowForm({ ...showForm, gold_price: Number(e.target.value) })}
                  className={`${inputSmClass} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-600 dark:text-slate-400">Platinum (₹)</label>
                <input
                  type="number"
                  min={50}
                  value={showForm.platinum_price}
                  onChange={(e) => setShowForm({ ...showForm, platinum_price: Number(e.target.value) })}
                  className={`${inputSmClass} font-mono`}
                />
              </div>
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
            >
              <Clock className="h-4 w-4" />
              {editingShowId ? 'Update Showtime' : 'Publish Showtime'}
            </button>
          </form>

          <div className={`lg:col-span-8 ${cardClass} p-6 overflow-x-auto`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Scheduled Shows ({filteredShows.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filter shows by city"
                  value={showCityFilter}
                  onChange={(e) => setShowCityFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
                >
                  <option value="ALL">All Cities</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter shows by date"
                  value={showDateFilter}
                  onChange={(e) => setShowDateFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
                >
                  <option value="ALL">All Dates</option>
                  {uniqueShowDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter shows by movie"
                  value={showMovieFilter}
                  onChange={(e) => setShowMovieFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-white/15 dark:bg-[#0A0E17] dark:text-white max-w-[160px]"
                >
                  <option value="ALL">All Movies</option>
                  {movies.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Movie</th>
                  <th className="pb-3 font-medium">Theatre &amp; Screen</th>
                  <th className="pb-3 font-medium">Date &amp; Time</th>
                  <th className="pb-3 font-medium">Seats</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {filteredShows.slice(0, 60).map((s) => {
                  const booked = s.booked_count ?? 0;
                  const total = s.total_seats ?? 64;
                  const isCancelled = s.status === 'CANCELLED';
                  return (
                    <tr key={s.id} className={isCancelled ? 'opacity-60' : ''}>
                      <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-white">
                        <div>{s.movie_title}</div>
                        <div className="text-[11px] font-normal font-mono text-slate-500">
                          ₹{s.silver_price} / ₹{s.gold_price} / ₹{s.platinum_price}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                        <div>{s.theatre_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {s.theatre_city} · {s.screen_name}
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <div>{s.show_date}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatTime12h(s.show_time)}
                          {s.end_time ? ` – ${formatTime12h(s.end_time)}` : ''}
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-mono tabular-nums whitespace-nowrap">
                        <span className="text-slate-900 dark:text-white font-semibold">{booked}</span>
                        <span className="text-slate-400"> / {total}</span>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {Math.max(0, total - booked)} open
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-semibold whitespace-nowrap">
                        <span
                          className={
                            s.booking_status === 'OPEN'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : s.booking_status === 'CANCELLED'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {s.booking_status || s.status}
                        </span>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => handleEditShow(s)}
                          title="Edit show"
                          className="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-slate-700 hover:border-slate-400 dark:border-white/15 dark:text-slate-200 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleShowStatus(s)}
                          title={isCancelled ? 'Reactivate show' : 'Cancel show'}
                          className="inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/15 cursor-pointer"
                        >
                          {isCancelled ? (
                            <>
                              <RotateCcw className="h-3 w-3" /> Restore
                            </>
                          ) : (
                            <>
                              <Ban className="h-3 w-3" /> Cancel
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteShow(s.id)}
                          title="Delete show"
                          className="inline-flex items-center rounded border border-rose-300 px-2 py-1 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-600/15 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredShows.length > 60 && (
              <p className="mt-3 text-xs text-slate-500">
                Showing first 60 of {filteredShows.length} matching shows. Use the city, date, or movie filters above to narrow results.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB: ALL BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className={`${cardClass} p-6 overflow-x-auto`}>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">
            All Bookings
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Booking ID</th>
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Movie &amp; Theatre</th>
                <th className="pb-3 font-medium">Showtime</th>
                <th className="pb-3 font-medium">Seats</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 pr-3 font-mono font-semibold text-slate-900 dark:text-white">
                    {b.booking_reference}
                  </td>
                  <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                    <div>{b.user_name}</div>
                    <div className="text-[11px] text-slate-500">{b.user_email}</div>
                  </td>
                  <td className="py-3 pr-3 text-slate-800 dark:text-slate-200">
                    <div>{b.movie_title}</div>
                    <div className="text-[11px] text-slate-500">{b.theatre_name}</div>
                  </td>
                  <td className="py-3 pr-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {b.show_date} {formatTime12h(b.show_time)}
                  </td>
                  <td className="py-3 pr-3 font-mono text-slate-800 dark:text-slate-200">
                    {b.seat_numbers || 'Released'}
                  </td>
                  <td className="py-3 pr-3 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    ₹{b.total_amount.toFixed(2)}
                  </td>
                  <td className="py-3 font-semibold">
                    <span
                      className={
                        b.status === 'CONFIRMED'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: REGISTERED USERS */}
      {activeTab === 'users' && (
        <div className={`${cardClass} p-6 overflow-x-auto`}>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">
            Registered Users
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
              <tr>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Phone</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Bookings</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-white">{u.name}</td>
                  <td className="py-3 pr-3 font-mono text-slate-700 dark:text-slate-300">{u.email}</td>
                  <td className="py-3 pr-3 font-mono text-slate-700 dark:text-slate-300">{u.phone}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={
                        u.role === 'ADMIN'
                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {u.booking_count ?? 0}
                  </td>
                  <td className="py-3 font-mono text-slate-500 dark:text-slate-400">{u.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
