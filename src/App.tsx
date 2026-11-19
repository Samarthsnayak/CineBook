import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { AppView, Movie, User } from './types/cinebook';
import { api } from './lib/api';
import { useTheme } from './hooks/useTheme';
import { useServerClock } from './hooks/useServerClock';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { MoviesView } from './components/MoviesView';
import { MovieDetailsView } from './components/MovieDetailsView';
import { TheatresView } from './components/TheatresView';
import { SeatSelectionView } from './components/SeatSelectionView';
import { BookingSummaryView } from './components/BookingSummaryView';
import { PaymentView } from './components/PaymentView';
import { TicketConfirmationView } from './components/TicketConfirmationView';
import { MyBookingsView } from './components/MyBookingsView';
import { OffersView } from './components/OffersView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { LoginView, RegisterView } from './components/AuthViews';
import { AdminDashboardView } from './components/AdminDashboardView';
import { JavaProjectExplorerView } from './components/JavaProjectExplorerView';

const SIDEBAR_STORAGE_KEY = 'cinebook_sidebar_collapsed';
const CITY_STORAGE_KEY = 'cinebook_selected_city';

function parseViewFromLocation(): AppView {
  if (typeof window === 'undefined') return { name: 'home' };
  const p = window.location.pathname.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/home') return { name: 'home' };
  if (p === '/movies') return { name: 'movies', initialStatus: 'ALL' };
  if (p === '/now-showing') return { name: 'movies', initialStatus: 'NOW_SHOWING' };
  if (p === '/upcoming') return { name: 'movies', initialStatus: 'UPCOMING' };
  if (p === '/theatres') return { name: 'theatres' };
  if (p === '/my-bookings') return { name: 'my-bookings' };
  if (p === '/offers') return { name: 'offers' };
  if (p === '/profile') return { name: 'profile' };
  if (p === '/settings') return { name: 'settings' };
  if (p === '/admin') return { name: 'admin', initialTab: 'movies' };
  if (p === '/admin/posters') return { name: 'admin', initialTab: 'posters' };
  if (p === '/login') return { name: 'login' };
  if (p === '/register') return { name: 'register' };
  if (p === '/java-source') return { name: 'java-source' };
  const movieMatch = p.match(/^\/movies\/(\d+)$/);
  if (movieMatch) return { name: 'movie-details', movieId: Number(movieMatch[1]) };
  return { name: 'home' };
}

function getPathForView(view: AppView): string | null {
  switch (view.name) {
    case 'home':
      return '/';
    case 'movies':
      if (view.initialStatus === 'NOW_SHOWING') return '/now-showing';
      if (view.initialStatus === 'UPCOMING') return '/upcoming';
      return '/movies';
    case 'movie-details':
      return `/movies/${view.movieId}`;
    case 'theatres':
      return '/theatres';
    case 'my-bookings':
      return '/my-bookings';
    case 'offers':
      return '/offers';
    case 'profile':
      return '/profile';
    case 'settings':
      return '/settings';
    case 'admin':
      return view.initialTab === 'posters' ? '/admin/posters' : '/admin';
    case 'login':
      return '/login';
    case 'register':
      return '/register';
    case 'java-source':
      return '/java-source';
    default:
      return null;
  }
}

export default function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  const serverClock = useServerClock('Asia/Kolkata');
  const [view, setView] = useState<AppView>(parseViewFromLocation);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [tmdbConfigured, setTmdbConfigured] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    try {
      return window.localStorage.getItem(CITY_STORAGE_KEY) || 'ALL';
    } catch {
      return 'ALL';
    }
  });
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
    try {
      window.localStorage.setItem(CITY_STORAGE_KEY, city);
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const handleToggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }, []);

  const refreshCatalog = useCallback(() => {
    setCatalogError(null);
    Promise.all([api.getMovies(), api.getCities()])
      .then(([mRes, cRes]) => {
        setMovies(mRes.movies);
        setTmdbConfigured(mRes.tmdbConfigured);
        setCities(cRes.cities);
        setCatalogVersion((v) => v + 1);
      })
      .catch((err) => {
        setCatalogError(
          err instanceof Error ? err.message : 'Unable to load movies and cities right now.'
        );
      });
  }, []);

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true));
    refreshCatalog();
  }, [refreshCatalog]);

  // Keep browser Back/Forward navigation synchronized
  useEffect(() => {
    const onPopState = () => {
      setView(parseViewFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const syncHistory = useCallback((next: AppView) => {
    try {
      const nextPath = getPathForView(next);
      if (nextPath && window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
    } catch {
      // Ignore history API restrictions in sandboxed frames
    }
  }, []);

  const navigate = useCallback(
    (next: AppView) => {
      // Protect user-specific routes: redirect unauthenticated visitors to Login and return afterward
      if (
        (next.name === 'my-bookings' || next.name === 'ticket' || next.name === 'profile') &&
        authReady &&
        !user
      ) {
        const loginView: AppView = { name: 'login', redirectAfter: next };
        setView(loginView);
        syncHistory(loginView);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setView(next);
      syncHistory(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [authReady, user, syncHistory]
  );

  // If auth resolves after initial mount while on a protected view, redirect cleanly
  useEffect(() => {
    if (
      authReady &&
      !user &&
      (view.name === 'my-bookings' || view.name === 'ticket' || view.name === 'profile')
    ) {
      setView({ name: 'login', redirectAfter: view });
    }
  }, [authReady, user, view]);

  const handleAuthSuccess = (loggedInUser: User, redirectAfter?: AppView) => {
    setUser(loggedInUser);
    const target = redirectAfter || { name: 'home' };
    setView(target);
    syncHistory(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout request warning:', err);
    } finally {
      setUser(null);
      const homeView: AppView = { name: 'home' };
      setView(homeView);
      syncHistory(homeView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FC] text-slate-900 dark:bg-[#080A10] dark:text-slate-100 transition-colors duration-200">
      {/* Left-Side Collapsible / Sliding Navigation Sidebar */}
      <Sidebar
        currentView={view}
        user={user}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggleCollapse={handleToggleSidebarCollapsed}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onNavigate={navigate}
        onLogout={handleLogout}
      />

      {/* Right Main Column (automatically expands/contracts alongside sidebar) */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar
          currentView={view}
          user={user}
          theme={theme}
          serverClock={serverClock}
          sidebarCollapsed={sidebarCollapsed}
          onToggleTheme={toggleTheme}
          onToggleDesktopSidebar={handleToggleSidebarCollapsed}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onNavigate={navigate}
        />

        {catalogError && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 no-print">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:px-6 lg:px-8">
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {catalogError}
              </span>
              <button
                type="button"
                onClick={refreshCatalog}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-500/20 dark:text-rose-100 dark:hover:bg-rose-500/30 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">
          {view.name === 'home' && (
            <HomeView
              movies={movies}
              tmdbConfigured={tmdbConfigured}
              cities={cities}
              selectedCity={selectedCity}
              onCityChange={handleCityChange}
              onNavigate={navigate}
            />
          )}

          {view.name === 'movies' && (
            <MoviesView
              key={`movies-${catalogVersion}`}
              initialQuery={view.initialQuery}
              initialStatus={view.initialStatus}
              initialLanguage={view.initialLanguage}
              onNavigate={navigate}
            />
          )}

          {view.name === 'movie-details' && (
            <MovieDetailsView
              key={`movie-${view.movieId}-${catalogVersion}`}
              movieId={view.movieId}
              cities={cities}
              selectedCity={selectedCity}
              serverClock={serverClock}
              onCityChange={handleCityChange}
              onNavigate={navigate}
            />
          )}

          {view.name === 'theatres' && (
            <TheatresView
              cities={cities}
              selectedCity={selectedCity}
              serverClock={serverClock}
              onCityChange={handleCityChange}
              onNavigate={navigate}
            />
          )}

          {view.name === 'offers' && <OffersView onNavigate={navigate} />}

          {view.name === 'profile' && (
            !authReady ? (
              <div className="mx-auto max-w-4xl px-4 py-12">
                <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
              </div>
            ) : user ? (
              <ProfileView user={user} onUserUpdated={setUser} onNavigate={navigate} />
            ) : null
          )}

          {view.name === 'settings' && (
            <SettingsView
              theme={theme}
              onSetTheme={setTheme}
              cities={cities}
              selectedCity={selectedCity}
              onCityChange={handleCityChange}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebarCollapsed={handleToggleSidebarCollapsed}
            />
          )}

          {view.name === 'seats' && (
            <SeatSelectionView
              showId={view.showId}
              serverClock={serverClock}
              onNavigate={navigate}
            />
          )}

          {view.name === 'summary' && (
            <BookingSummaryView
              show={view.show}
              seats={view.seats}
              user={user}
              serverClock={serverClock}
              onNavigate={navigate}
            />
          )}

          {view.name === 'payment' && (
            <PaymentView
              show={view.show}
              seats={view.seats}
              serverClock={serverClock}
              onNavigate={navigate}
            />
          )}

          {view.name === 'ticket' && (
            <TicketConfirmationView
              bookingRef={view.bookingRef}
              initialBooking={view.booking}
              justBooked={view.justBooked}
              onNavigate={navigate}
            />
          )}

          {view.name === 'my-bookings' && (
            !authReady ? (
              <div className="mx-auto max-w-5xl px-4 py-12">
                <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
              </div>
            ) : user ? (
              <MyBookingsView user={user} onNavigate={navigate} />
            ) : null
          )}

          {view.name === 'login' && (
            <LoginView
              adminMode={view.adminMode}
              redirectAfter={view.redirectAfter}
              onAuthSuccess={handleAuthSuccess}
              onNavigate={navigate}
            />
          )}

          {view.name === 'register' && (
            <RegisterView
              redirectAfter={view.redirectAfter}
              onAuthSuccess={handleAuthSuccess}
              onNavigate={navigate}
            />
          )}

          {view.name === 'admin' && (
            <AdminDashboardView
              user={user}
              initialTab={view.initialTab}
              serverClock={serverClock}
              onAuthSuccess={handleAuthSuccess}
              onNavigate={navigate}
              onCatalogUpdated={refreshCatalog}
            />
          )}

          {view.name === 'java-source' && (
            <JavaProjectExplorerView onNavigate={navigate} />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white py-8 dark:border-white/[0.08] dark:bg-[#080A10] transition-colors duration-200 no-print">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-600 dark:text-slate-400 sm:flex-row sm:px-6 lg:px-8">
            <span>© 2026 CineBook – Online Movie Ticket Booking System</span>
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={() => navigate({ name: 'movies', initialStatus: 'ALL' })}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Movies
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'theatres' })}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Theatres
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'my-bookings' })}
                className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                My Bookings
              </button>
              <button
                type="button"
                onClick={() => navigate({ name: 'java-source' })}
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer font-medium"
              >
                Java Spring Boot Source
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
