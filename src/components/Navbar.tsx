import { useState, type FormEvent } from 'react';
import { Clock, Film, Menu, Moon, PanelLeft, Search, Sun, X } from 'lucide-react';
import type { AppView, User } from '../types/cinebook';
import type { Theme } from '../hooks/useTheme';
import type { LiveServerClockState } from '../hooks/useServerClock';

interface NavbarProps {
  currentView: AppView;
  user: User | null;
  theme: Theme;
  serverClock: LiveServerClockState;
  sidebarCollapsed: boolean;
  onToggleTheme: () => void;
  onToggleDesktopSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onNavigate: (view: AppView) => void;
}

function getPageTitle(view: AppView): string {
  switch (view.name) {
    case 'home':
      return 'Home';
    case 'movies':
      if (view.initialStatus === 'NOW_SHOWING') return 'Now Showing';
      if (view.initialStatus === 'UPCOMING') return 'Upcoming Movies';
      return 'All Movies';
    case 'movie-details':
      return 'Movie Details';
    case 'theatres':
      return 'Theatres';
    case 'seats':
      return 'Seat Selection';
    case 'summary':
      return 'Booking Summary';
    case 'payment':
      return 'Payment';
    case 'ticket':
      return 'Ticket Confirmation';
    case 'my-bookings':
      return 'My Bookings';
    case 'offers':
      return 'Offers';
    case 'profile':
      return 'My Profile';
    case 'settings':
      return 'Settings';
    case 'admin':
      return view.initialTab === 'posters' ? 'Manage Movie Posters' : 'Admin Dashboard';
    case 'login':
      return view.adminMode ? 'Admin Sign In' : 'Sign In';
    case 'register':
      return 'Create Account';
    case 'java-source':
      return 'Java Spring Boot Source';
    default:
      return 'CineBook';
  }
}

export function Navbar({
  currentView,
  user,
  theme,
  serverClock,
  sidebarCollapsed,
  onToggleTheme,
  onToggleDesktopSidebar,
  onOpenMobileSidebar,
  onNavigate,
}: NavbarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const isDark = theme === 'dark';
  const pageTitle = getPageTitle(currentView);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    onNavigate({ name: 'movies', initialQuery: q, initialStatus: 'ALL' });
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#080A10]/90 transition-colors duration-200 no-print">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: Sidebar Trigger + Mobile Brand / Desktop Page Title */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06] dark:hover:text-white lg:hidden cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop Sidebar Collapse / Expand Trigger */}
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white cursor-pointer"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          {/* Mobile Compact Logo */}
          <button
            type="button"
            onClick={() => onNavigate({ name: 'home' })}
            className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white lg:hidden whitespace-nowrap cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white">
              <Film className="h-3.5 w-3.5" />
            </span>
            <span className="font-display">CineBook</span>
          </button>

          {/* Desktop Contextual Page Title */}
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {pageTitle}
            </span>
          </div>
        </div>

        {/* Right: Live IST Clock + Quick Movie Search + Theme Switcher + User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            title={`Live Cinema Time (${serverClock.timezone})`}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 whitespace-nowrap"
          >
            <Clock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="hidden xl:inline text-slate-500 dark:text-slate-400">
              {serverClock.formattedDate}
            </span>
            <span className="hidden xl:inline text-slate-300 dark:text-slate-600">·</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {serverClock.time12}
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">IST</span>
          </div>

          <form onSubmit={handleSearch} className="relative hidden md:block w-48 xl:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search movies..."
              aria-label="Search movies"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-[#101522]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          {/* Dark / Light Theme Switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 sm:px-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-200/80 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/30 dark:hover:bg-white/[0.08] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-indigo-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Profile / Sign In Control */}
          {user ? (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'profile' })}
              title={`${user.name} · View Profile`}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/30 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                {initials}
              </span>
              <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'login' })}
              className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
