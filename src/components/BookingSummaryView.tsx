import { AlertTriangle, ArrowLeft, Calendar, MapPin, ShieldCheck, Ticket } from 'lucide-react';
import type { AppView, SeatSlot, ShowItem, User } from '../types/cinebook';
import type { LiveServerClockState } from '../hooks/useServerClock';
import { calculatePricing, formatTime12h, showStartEpochMsIST } from '../lib/api';

interface BookingSummaryViewProps {
  show: ShowItem;
  seats: SeatSlot[];
  user: User | null;
  serverClock: LiveServerClockState;
  onNavigate: (view: AppView) => void;
}

export function BookingSummaryView({
  show,
  seats,
  user,
  serverClock,
  onNavigate,
}: BookingSummaryViewProps) {
  const { subtotal, convenienceFee, taxAmount, totalAmount } = calculatePricing(seats);
  const showExpired = serverClock.nowMs >= showStartEpochMsIST(show.show_date, show.show_time);

  const handleConfirm = () => {
    if (showExpired) return;
    const nextView: AppView = { name: 'payment', show, seats };
    if (!user) {
      onNavigate({ name: 'login', redirectAfter: nextView });
      return;
    }
    onNavigate(nextView);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'seats', showId: show.id })}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Modify Seat Selection
      </button>

      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-2">
        Booking Summary
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">
        Review your selected movie, theatre, showtime, seats, convenience fee, taxes, and final payable amount.
      </p>

      {showExpired && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>
            This showtime ({formatTime12h(show.show_time)} IST) has already started and can no longer be booked. Please choose an upcoming showtime.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:p-8">
        {/* Movie & Show Info */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6 sm:flex-row">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {show.movie_title}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {show.movie_language} · {show.movie_certificate} · {show.screen_name} ({show.screen_format})
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
              <span>
                {show.theatre_name}, {show.theatre_city}
              </span>
            </div>
            {show.theatre_address && (
              <p className="mt-0.5 pl-6 text-xs text-slate-500 dark:text-slate-400">
                {show.theatre_address}
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
              <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              {show.show_date}
            </div>
            <div className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {formatTime12h(show.show_time)}
              {show.end_time ? ` – ${formatTime12h(show.end_time)}` : ''}
            </div>
          </div>
        </div>

        {/* Itemized Seat Breakdown */}
        <div className="py-6 border-b border-slate-200 dark:border-white/[0.08]">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Ticket className="h-4 w-4 text-rose-500" />
            Selected Seats ({seats.length} {seats.length === 1 ? 'Ticket' : 'Tickets'})
          </h3>
          <div className="space-y-2.5">
            {seats.map((seat) => (
              <div key={seat.id} className="flex items-center justify-between text-sm">
                <div className="text-slate-700 dark:text-slate-200">
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {seat.seatNumber}
                  </span>
                  <span className="mx-2 text-slate-400 dark:text-slate-600">·</span>
                  <span className="text-slate-600 dark:text-slate-400">{seat.category}</span>
                </div>
                <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                  ₹{seat.price.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Price Totals with Taxes & Additional Charges */}
        <div className="space-y-2.5 py-6">
          <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
            <span>Ticket Price ({seats.length} {seats.length === 1 ? 'seat' : 'seats'})</span>
            <span className="font-mono tabular-nums">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Convenience Fee (₹30 × {seats.length})</span>
            <span className="font-mono tabular-nums">₹{convenienceFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>GST (18% on Convenience Fee)</span>
            <span className="font-mono tabular-nums">₹{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-white/[0.08] pt-4 text-lg font-bold text-slate-900 dark:text-white">
            <span>Final Total Amount</span>
            <span className="font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {!user && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            Sign in required to confirm payment. Your selected seats will be preserved when you return from sign-in.
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onNavigate({ name: 'seats', showId: show.id })}
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/30 dark:hover:text-white transition-colors cursor-pointer"
          >
            Back to Seat Map
          </button>

          <button
            type="button"
            disabled={showExpired}
            onClick={handleConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            Proceed to Payment (₹{totalAmount.toFixed(2)})
          </button>
        </div>
      </div>
    </div>
  );
}
