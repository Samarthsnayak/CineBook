import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Info } from 'lucide-react';
import type { AppView, SeatSlot, ShowItem } from '../types/cinebook';
import type { LiveServerClockState } from '../hooks/useServerClock';
import { api, formatTime12h, showStartEpochMsIST } from '../lib/api';

interface SeatSelectionViewProps {
  showId: number;
  serverClock: LiveServerClockState;
  onNavigate: (view: AppView) => void;
}

export function SeatSelectionView({ showId, serverClock, onNavigate }: SeatSelectionViewProps) {
  const [show, setShow] = useState<ShowItem | null>(null);
  const [seats, setSeats] = useState<SeatSlot[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [serverBlockReason, setServerBlockReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setServerBlockReason(null);
    api
      .getShowSeats(showId)
      .then((res) => {
        if (!active) return;
        setShow(res.show);
        setSeats(res.seats);
        if (!res.isBookable) {
          setServerBlockReason(
            res.bookingBlockReason || 'This showtime is no longer available for booking.'
          );
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load seating map.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showId]);

  // Live cutoff guard: immediately blocks checkout if the show starts while the user is picking seats
  const liveBlockReason = useMemo(() => {
    if (serverBlockReason) return serverBlockReason;
    if (!show) return null;
    if (show.status === 'CANCELLED') {
      return 'This show has been cancelled by the theatre administrator.';
    }
    const startEpoch = showStartEpochMsIST(show.show_date, show.show_time);
    if (serverClock.nowMs >= startEpoch) {
      return `Booking closed: this showtime (${formatTime12h(show.show_time)} IST) has already started.`;
    }
    return null;
  }, [serverBlockReason, show, serverClock.nowMs]);

  const groupedByCategory = useMemo(() => {
    const categories: Array<'SILVER' | 'GOLD' | 'PLATINUM'> = ['SILVER', 'GOLD', 'PLATINUM'];
    return categories
      .map((cat) => {
        const catSeats = seats.filter((s) => s.category === cat);
        const rowsMap = new Map<string, SeatSlot[]>();
        for (const s of catSeats) {
          const list = rowsMap.get(s.rowLabel) ?? [];
          list.push(s);
          rowsMap.set(s.rowLabel, list);
        }
        return {
          category: cat,
          price: catSeats[0]?.price ?? 0,
          rows: Array.from(rowsMap.entries()),
        };
      })
      .filter((g) => g.rows.length > 0);
  }, [seats]);

  const selectedSeats = useMemo(
    () => seats.filter((s) => selectedIds.includes(s.id)),
    [seats, selectedIds]
  );

  const subtotal = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + s.price, 0),
    [selectedSeats]
  );

  const availableCount = useMemo(() => seats.filter((s) => !s.booked).length, [seats]);

  const toggleSeat = (seat: SeatSlot) => {
    if (seat.booked || liveBlockReason) return;
    setError('');
    setSelectedIds((prev) => {
      if (prev.includes(seat.id)) {
        return prev.filter((id) => id !== seat.id);
      }
      if (prev.length >= 10) {
        setError('You can select up to 10 seats per booking.');
        return prev;
      }
      return [...prev, seat.id];
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
      </div>
    );
  }

  if (!show) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-rose-600 dark:text-rose-400">{error || 'Show not found.'}</p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'movies' })}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
        >
          Back to Movies
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'movie-details', movieId: show.movie_id })}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Change Showtime
      </button>

      {/* Showtime Header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            {show.movie_title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {show.theatre_name} ({show.theatre_city}) · {show.screen_name} · {show.show_date} at{' '}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {formatTime12h(show.show_time)}
              {show.end_time ? ` – ${formatTime12h(show.end_time)}` : ''}
            </span>
          </p>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
          Silver ₹{show.silver_price} · Gold ₹{show.gold_price} · Platinum ₹{show.platinum_price} ·{' '}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {availableCount}/{seats.length} open
          </span>
        </div>
      </div>

      {/* Live Showtime Closed / Cancelled Guard Banner */}
      {liveBlockReason && (
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border border-rose-300 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <div className="font-semibold">Booking Unavailable for This Showtime</div>
              <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-200/90">{liveBlockReason}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'movie-details', movieId: show.movie_id })}
            className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap cursor-pointer shrink-0"
          >
            Choose Another Showtime
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200">
          <Info className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Cinema Auditorium Layout */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:p-8">
        <div className="mx-auto mb-10 max-w-lg text-center">
          <div className="h-2.5 w-full rounded-t-full bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_12px_30px_rgba(225,29,72,0.32)]" />
          <p className="mt-2.5 text-xs tracking-wider text-slate-500 dark:text-slate-400">
            All Eyes This Way — Cinema Screen
          </p>
        </div>

        <div className="space-y-8 overflow-x-auto pb-2">
          {groupedByCategory.map((group) => (
            <div key={group.category} className="min-w-[460px]">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06] pb-1.5 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {group.category === 'SILVER'
                    ? 'Silver Tier (Front)'
                    : group.category === 'GOLD'
                    ? 'Gold Tier (Classic Center)'
                    : 'Platinum Tier (Luxury Rear)'}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  ₹{group.price} / seat
                </span>
              </div>

              <div className="space-y-2.5">
                {group.rows.map(([rowLabel, rowSeats]) => {
                  const midAisle = Math.floor(rowSeats.length / 2);
                  return (
                    <div key={rowLabel} className="flex items-center justify-center gap-2">
                      <span className="w-6 text-right font-mono text-xs font-semibold text-slate-500">
                        {rowLabel}
                      </span>

                      <div className="flex items-center gap-2">
                        {rowSeats.map((seat, idx) => {
                          const isSelected = selectedIds.includes(seat.id);
                          const aisleSpacer = idx === midAisle && rowSeats.length >= 6 ? 'ml-6' : '';
                          const isDisabled = seat.booked || Boolean(liveBlockReason);
                          const baseClasses =
                            'h-9 w-10 rounded-t-lg rounded-b-sm font-mono text-xs font-semibold transition-all tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500';
                          let stateClasses = '';

                          if (seat.booked) {
                            stateClasses =
                              'border border-slate-200 bg-slate-200 text-slate-400 line-through cursor-not-allowed dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-600';
                          } else if (liveBlockReason) {
                            stateClasses =
                              'border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-600';
                          } else if (isSelected) {
                            stateClasses =
                              'border border-rose-500 bg-rose-600 text-white shadow-[0_0_14px_rgba(225,29,72,0.4)] cursor-pointer dark:border-rose-400';
                          } else {
                            stateClasses =
                              'border border-slate-300 bg-slate-50 text-slate-800 hover:border-rose-500 hover:bg-rose-50 cursor-pointer dark:border-slate-700 dark:bg-[#172033] dark:text-slate-200 dark:hover:border-rose-500 dark:hover:bg-rose-600/20';
                          }

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => toggleSeat(seat)}
                              title={`${seat.seatNumber} · ${seat.category} · ₹${seat.price}${
                                seat.booked ? ' (Booked)' : ''
                              }`}
                              className={`${baseClasses} ${stateClasses} ${aisleSpacer}`}
                            >
                              {seat.seatNumber}
                            </button>
                          );
                        })}
                      </div>

                      <span className="w-6 font-mono text-xs font-semibold text-slate-500">
                        {rowLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Seat Color Legend */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-slate-200 dark:border-white/[0.08] pt-5 text-xs text-slate-700 dark:text-slate-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-[#172033]" />
            Available
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-rose-500 bg-rose-600 dark:border-rose-400" />
            Selected
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-900" />
            Booked (Unavailable)
          </span>
        </div>
      </div>

      {/* Dynamic Bottom Checkout Summary Bar */}
      <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#151C2E] dark:shadow-none sm:flex-row sm:items-center">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Selected Seats ({selectedSeats.length})
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
            {selectedSeats.length > 0
              ? selectedSeats.map((s) => `${s.seatNumber} (${s.category})`).join(', ')
              : 'Tap any available seat above to begin'}
          </div>
        </div>

        <div className="flex items-center justify-between gap-5 sm:justify-end">
          <div className="text-left sm:text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">Ticket Subtotal</div>
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              ₹{subtotal.toFixed(2)}
            </div>
          </div>

          <button
            type="button"
            disabled={selectedSeats.length === 0 || Boolean(liveBlockReason)}
            onClick={() => onNavigate({ name: 'summary', show, seats: selectedSeats })}
            className="rounded-lg bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-700 dark:hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 whitespace-nowrap cursor-pointer"
          >
            Continue to Summary
          </button>
        </div>
      </div>
    </div>
  );
}
