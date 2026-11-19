import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Ticket,
  User as UserIcon,
} from 'lucide-react';
import type { AppView, User } from '../types/cinebook';
import { api } from '../lib/api';

interface ProfileViewProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onNavigate: (view: AppView) => void;
}

export function ProfileView({ user, onUserUpdated, onNavigate }: ProfileViewProps) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [bookingCount, setBookingCount] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone);
  }, [user]);

  useEffect(() => {
    api
      .getMyBookings()
      .then((res) => setBookingCount(res.bookings.length))
      .catch(() => setBookingCount(null));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const res = await api.updateProfile({ name, phone });
      onUserUpdated(res.user);
      setFeedback({ type: 'success', text: res.message || 'Profile updated successfully.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your CineBook account details and quick access to your tickets.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Account Overview Card */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none h-fit">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-600 text-lg font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-bold text-slate-900 dark:text-white">
                {user.name}
              </div>
              <div className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
              <div className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {user.role === 'ADMIN' ? 'Administrator Account' : 'CineBook Member'}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm dark:border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Bookings</span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                {bookingCount !== null ? bookingCount : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Account Role</span>
              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                {user.role}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'my-bookings' })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] cursor-pointer"
            >
              <Ticket className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              View My Bookings
            </button>

            {user.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => onNavigate({ name: 'admin', initialTab: 'posters' })}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                Manage Movie Posters
              </button>
            )}
          </div>
        </div>

        {/* Edit Account Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none space-y-5"
        >
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Personal Details
          </h2>

          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-xs ${
                feedback.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/35 dark:bg-rose-950/40 dark:text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <UserIcon className="h-3.5 w-3.5" />
              Full Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Mail className="h-3.5 w-3.5" />
              Email Address
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Phone className="h-3.5 w-3.5" />
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
