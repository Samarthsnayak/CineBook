import { useEffect } from 'react';
import {
  Building2,
  CalendarClock,
  Clapperboard,
  Film,
  Home,
  ImagePlus,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  UserCircle,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AppView, User } from '../types/cinebook';

interface SidebarProps {
  currentView: AppView;
  user: User | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  view: AppView;
  isActive: (view: AppView) => boolean;
}

export function Sidebar({
  currentView,
  user,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onNavigate,
  onLogout,
}: SidebarProps) {
  const isAdmin = user?.role === 'ADMIN';

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const browseItems: SidebarItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      view: { name: 'home' },
      isActive: (v) => v.name === 'home',
    },
    {
      id: 'all-movies',
      label: 'All Movies',
      icon: Film,
      view: { name: 'movies', initialStatus: 'ALL' },
      isActive: (v) =>
        (v.name === 'movies' && (!v.initialStatus || v.initialStatus === 'ALL')) ||
        v.name === 'movie-details',
    },
    {
      id: 'now-showing',
      label: 'Now Showing',
      icon: Clapperboard,
      view: { name: 'movies', initialStatus: 'NOW_SHOWING' },
      isActive: (v) => v.name === 'movies' && v.initialStatus === 'NOW_SHOWING',
    },
    {
      id: 'upcoming',
      label: 'Upcoming Movies',
      icon: CalendarClock,
      view: { name: 'movies', initialStatus: 'UPCOMING' },
      isActive: (v) => v.name === 'movies' && v.initialStatus === 'UPCOMING',
    },
    {
      id: 'theatres',
      label: 'Theatres',
      icon: Building2,
      view: { name: 'theatres' },
      isActive: (v) => v.name === 'theatres',
    },
    {
      id: 'offers',
      label: 'Offers',
      icon: Tag,
      view: { name: 'offers' },
      isActive: (v) => v.name === 'offers',
    },
  ];

  const accountItems: SidebarItem[] = [
    {
      id: 'my-bookings',
      label: 'My Bookings',
      icon: Ticket,
      view: { name: 'my-bookings' },
      isActive: (v) => v.name === 'my-bookings' || v.name === 'ticket',
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: UserCircle,
      view: { name: 'profile' },
      isActive: (v) => v.name === 'profile',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      view: { name: 'settings' },
      isActive: (v) => v.name === 'settings',
    },
  ];

  const adminItems: SidebarItem[] = isAdmin
    ? [
        {
          id: 'admin-dashboard',
          label: 'Admin Dashboard',
          icon: ShieldCheck,
          view: { name: 'admin', initialTab: 'movies' },
          isActive: (v) => v.name === 'admin' && v.initialTab !== 'posters',
        },
        {
          id: 'manage-posters',
          label: 'Manage Movie Posters',
          icon: ImagePlus,
          view: { name: 'admin', initialTab: 'posters' },
          isActive: (v) => v.name === 'admin' && v.initialTab === 'posters',
        },
      ]
    : [];

  const handleSelect = (view: AppView) => {
    onCloseMobile();
    onNavigate(view);
  };

  const renderSection = (title: string, items: SidebarItem[], isCompact: boolean) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        {!isCompact ? (
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-500">
            {title}
          </div>
        ) : (
          <div className="mx-3 my-2 h-px bg-slate-200 dark:bg-white/[0.08]" />
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(currentView);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.view)}
              title={isCompact ? item.label : undefined}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex w-full items-center rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isCompact ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                active
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  active
                    ? 'text-white'
                    : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-white'
                }`}
              />
              {!isCompact && <span className="truncate whitespace-nowrap">{item.label}</span>}

              {/* Floating Tooltip when Collapsed on Desktop */}
              {isCompact && (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-white/15 dark:bg-[#171E30]">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderSidebarBody = (isCompact: boolean, isMobileDrawer: boolean) => {
    const initials = user?.name
      ? user.name
          .split(' ')
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : '';

    return (
      <div className="flex h-full flex-col bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-white/[0.08] transition-colors duration-200">
        {/* Top Brand Row */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 dark:border-white/[0.08] ${
            isCompact ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSelect({ name: 'home' })}
            title="CineBook Home"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm">
              <Film className="h-4 w-4" />
            </span>
            {!isCompact && <span className="font-display tracking-tight">CineBook</span>}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          ) : !isCompact ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Expand Button when Collapsed */}
        {!isMobileDrawer && isCompact && (
          <div className="flex justify-center pt-3">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav
          aria-label="Sidebar Navigation"
          className="flex-1 overflow-y-auto overflow-x-visible px-2.5 py-3 space-y-4"
        >
          {renderSection('Discover', browseItems, isCompact)}
          {renderSection('Account', accountItems, isCompact)}
          {isAdmin && renderSection('Administration', adminItems, isCompact)}
        </nav>

        {/* Bottom User Info & Logout / Sign In */}
        <div className="shrink-0 border-t border-slate-200 p-3 dark:border-white/[0.08]">
          {user ? (
            <div className="space-y-2">
              {!isCompact ? (
                <button
                  type="button"
                  onClick={() => handleSelect({ name: 'profile' })}
                  className="flex w-full items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 text-left hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600/15 text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {user.name}
                    </div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {user.role === 'ADMIN' ? 'Administrator' : user.email}
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelect({ name: 'profile' })}
                  title={`${user.name} (${user.role === 'ADMIN' ? 'Administrator' : 'Member'})`}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-rose-600/15 text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 cursor-pointer"
                >
                  {initials}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onLogout();
                }}
                title={isCompact ? 'Logout' : undefined}
                aria-label="Logout"
                className={`group relative flex w-full items-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 transition-colors cursor-pointer ${
                  isCompact ? 'justify-center py-2.5 px-2' : 'gap-2.5 px-3 py-2'
                }`}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!isCompact && <span>Logout</span>}
                {isCompact && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-white/15 dark:bg-[#171E30]">
                    Logout
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className={`flex ${isCompact ? 'flex-col items-center gap-2' : 'gap-2'}`}>
              <button
                type="button"
                onClick={() => handleSelect({ name: 'login' })}
                title={isCompact ? 'Sign In' : undefined}
                aria-label="Sign In"
                className={`flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors cursor-pointer ${
                  isCompact ? 'h-9 w-9' : 'flex-1 py-2 px-3'
                }`}
              >
                <LogIn className="h-4 w-4 shrink-0" />
                {!isCompact && <span>Sign In</span>}
              </button>
              <button
                type="button"
                onClick={() => handleSelect({ name: 'register' })}
                title={isCompact ? 'Register' : undefined}
                aria-label="Register"
                className={`flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/[0.06] transition-colors cursor-pointer ${
                  isCompact ? 'h-9 w-9' : 'flex-1 py-2 px-3'
                }`}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                {!isCompact && <span>Register</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop & Tablet Collapsible Sidebar */}
      <aside
        aria-label="Primary Sidebar"
        className={`hidden lg:block shrink-0 sticky top-0 h-screen z-30 transition-[width] duration-200 ease-out no-print ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {renderSidebarBody(collapsed, false)}
      </aside>

      {/* Mobile Slide-In Drawer Overlay */}
      <div
        className={`fixed inset-0 z-50 lg:hidden no-print transition-opacity duration-200 ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={onCloseMobile}
          className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        />
        <aside
          aria-label="Mobile Navigation Drawer"
          className={`relative h-full w-72 max-w-[85vw] shadow-2xl transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarBody(false, true)}
        </aside>
      </div>
    </>
  );
}
