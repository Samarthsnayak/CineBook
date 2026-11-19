import { MapPin, Moon, PanelLeft, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

interface SettingsViewProps {
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  cities: string[];
  selectedCity: string;
  onCityChange: (city: string) => void;
  sidebarCollapsed: boolean;
  onToggleSidebarCollapsed: () => void;
}

export function SettingsView({
  theme,
  onSetTheme,
  cities,
  selectedCity,
  onCityChange,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
}: SettingsViewProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Personalise your CineBook appearance, preferred city, and workspace layout.
        </p>
      </div>

      <div className="space-y-5">
        {/* Theme Preference */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Appearance Theme
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Switch instantly between Dark Mode and Light Mode. Saved automatically in your browser.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-[#0A0E17]">
              <button
                type="button"
                onClick={() => onSetTheme('dark')}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark Mode
              </button>
              <button
                type="button"
                onClick={() => onSetTheme('light')}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                Light Mode
              </button>
            </div>
          </div>
        </div>

        {/* Preferred City */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
                <MapPin className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Default Booking City
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Pre-filters theatres and showtimes to your preferred city.
              </p>
            </div>
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white sm:w-56"
            >
              <option value="ALL">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sidebar Layout */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
                <PanelLeft className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Desktop Sidebar Layout
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Toggle between full icon-and-label sidebar or compact icon-only rail.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleSidebarCollapsed}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] cursor-pointer"
            >
              {sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
