import { useState, type FormEvent } from 'react';
import { AlertCircle, Lock, Shield, UserPlus } from 'lucide-react';
import type { AppView, User } from '../types/cinebook';
import { api } from '../lib/api';

interface LoginViewProps {
  adminMode?: boolean;
  redirectAfter?: AppView;
  onAuthSuccess: (user: User, redirectAfter?: AppView) => void;
  onNavigate: (view: AppView) => void;
}

export function LoginView({ adminMode, redirectAfter, onAuthSuccess, onNavigate }: LoginViewProps) {
  const [email, setEmail] = useState(adminMode ? 'admin@cinebook.com' : '');
  const [password, setPassword] = useState(adminMode ? 'Admin@123' : '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.login(email, password);
      if (adminMode && res.user.role !== 'ADMIN') {
        setError('This account does not have Administrator privileges.');
        return;
      }
      onAuthSuccess(res.user, redirectAfter || (res.user.role === 'ADMIN' && adminMode ? { name: 'admin' } : { name: 'home' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:p-8">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {adminMode ? <Shield className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {adminMode ? 'Administrator Portal' : 'Member Access'}
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {adminMode ? 'Admin Sign In' : 'Sign In to CineBook'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {adminMode
              ? 'Manage movies, theatres, screens, showtimes, and ticket pricing.'
              : 'Access your bookings, reserve seats, and download QR passes.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Credential Fillers */}
        <div className="mt-6 border-t border-slate-200 dark:border-white/[0.08] pt-5">
          <div className="mb-2.5 text-xs text-slate-500 dark:text-slate-400">
            Quick demo login credentials:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('user@cinebook.com');
                setPassword('User@123');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-slate-300 dark:border-white/10 dark:bg-[#151C2E] dark:hover:border-white/25 cursor-pointer"
            >
              <div className="font-semibold text-slate-900 dark:text-white">Customer</div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                user@cinebook.com
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@cinebook.com');
                setPassword('Admin@123');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-slate-300 dark:border-white/10 dark:bg-[#151C2E] dark:hover:border-white/25 cursor-pointer"
            >
              <div className="font-semibold text-slate-900 dark:text-white">Admin</div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                admin@cinebook.com
              </div>
            </button>
          </div>
        </div>

        {!adminMode && (
          <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
            New to CineBook?{' '}
            <button
              type="button"
              onClick={() => onNavigate({ name: 'register', redirectAfter })}
              className="font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
            >
              Create an account
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

interface RegisterViewProps {
  redirectAfter?: AppView;
  onAuthSuccess: (user: User, redirectAfter?: AppView) => void;
  onNavigate: (view: AppView) => void;
}

export function RegisterView({ redirectAfter, onAuthSuccess, onNavigate }: RegisterViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.register({ name, email, phone, password });
      onAuthSuccess(res.user, redirectAfter || { name: 'home' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:p-8">
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <UserPlus className="h-4 w-4" />
            New Member
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Create Your Account
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Register with your details to book seats and store digital tickets securely.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Aarav Sharma"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="aarav@example.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="9876543210"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Password (minimum 6 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Create a secure password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate({ name: 'login', redirectAfter })}
            className="font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
