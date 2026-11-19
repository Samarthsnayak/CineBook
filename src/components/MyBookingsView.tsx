import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Printer, Ticket, XCircle } from 'lucide-react';
import type { AppView, BookingRecord, User } from '../types/cinebook';
import { api, formatTime12h } from '../lib/api';
import { buildTicketHtml, downloadDigitalTicket } from '../lib/ticketExport';
import { PosterArtwork } from './PosterArtwork';

interface MyBookingsViewProps {
  user: User;
  onNavigate: (view: AppView) => void;
}

export function MyBookingsView({ user, onNavigate }: MyBookingsViewProps) {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [tab, setTab] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadBookings = () => {
    setLoading(true);
    api
      .getMyBookings()
      .then((res) => {
        setBookings(res.bookings);
      })
      .catch((err) =>
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Unable to load bookings.',
        })
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, [user.id]);

  const now = Date.now();
  const filtered = bookings.filter((b) => {
    const showTimeMs = new Date(`${b.show_date}T${b.show_time}:00`).getTime();
    if (tab === 'UPCOMING') return b.status === 'CONFIRMED' && showTimeMs >= now;
    if (tab === 'PAST') return b.status === 'CANCELLED' || showTimeMs < now;
    return true;
  });

  const handleCancel = async (bookingId: number) => {
    setFeedback(null);
    setCancellingId(bookingId);
    try {
      const res = await api.cancelBooking(bookingId);
      setFeedback({ type: 'success', text: res.message });
      loadBookings();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Cancellation failed.',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handlePrintFromCard = (booking: BookingRecord) => {
    // Print cleanly via hidden iframe (avoids window.open popup blocks inside iframes)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(buildTicketHtml(booking));
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1000);
      }, 250);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            My Bookings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Signed in as{' '}
            <span className="text-slate-900 dark:text-white font-medium">{user.name}</span> ({user.email}). Free cancellation available up to 2 hours prior to showtime.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <button
            type="button"
            onClick={() => setTab('ALL')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              tab === 'ALL'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All Bookings ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('UPCOMING')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              tab === 'UPCOMING'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setTab('PAST')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              tab === 'PAST'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Past / Cancelled
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm ${
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

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-[#101522]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-white/[0.08] dark:bg-[#101522]">
          <Ticket className="mx-auto mb-3 h-9 w-9 text-slate-400 dark:text-slate-500" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">
            {tab === 'ALL'
              ? 'You have not booked any movie tickets yet.'
              : tab === 'UPCOMING'
              ? 'No upcoming movie bookings.'
              : 'No past or cancelled bookings found.'}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Browse currently running Indian movies to book seats and receive an instant QR ticket.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'movies', initialStatus: 'NOW_SHOWING' })}
            className="mt-5 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
          >
            Browse Now Showing
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const seatList =
              b.seats && b.seats.length > 0
                ? b.seats.map((s) => `${s.seat_number} (${s.category})`).join(', ')
                : b.seat_numbers || b.seat_summary || 'Seats Released';
            const ticketCount = b.ticket_count || b.seats?.length || 1;

            return (
              <article
                key={b.id}
                className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none md:flex-row md:items-center"
              >
                {/* 1. Movie Poster */}
                <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 aspect-[2/3]">
                  <PosterArtwork
                    title={b.movie_title}
                    posterUrl={b.movie_poster}
                    language={b.movie_language}
                    certificate={b.movie_certificate}
                    compact
                  />
                </div>

                {/* Core Booking Fields 1–9 */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      Booking ID: {b.booking_reference}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span
                      className={`font-semibold ${
                        b.status === 'CONFIRMED'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      Booking: {b.status}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span
                      className={`font-medium ${
                        b.payment_status === 'SUCCESS'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : b.payment_status === 'REFUNDED'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      Payment: {b.payment_status || 'SUCCESS'} ({b.payment_method || 'UPI'})
                    </span>
                  </div>

                  <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                    {b.movie_title}
                  </h2>

                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {b.theatre_name} ({b.theatre_city}) · {b.screen_name}
                  </p>

                  <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-3">
                    <div>
                      <span className="text-slate-500">Show:</span>{' '}
                      <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                        {b.show_date} · {formatTime12h(b.show_time)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Tickets:</span>{' '}
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {ticketCount} {ticketCount === 1 ? 'Ticket' : 'Tickets'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Paid:</span>{' '}
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        ₹{b.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500">Seats:</span>{' '}
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {seatList}
                    </span>
                  </p>
                </div>

                {/* Actions: View Ticket, Download Ticket, Print Ticket, Cancel */}
                <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-stretch md:w-40 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        name: 'ticket',
                        bookingRef: b.booking_reference,
                        booking: b,
                      })
                    }
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer whitespace-nowrap"
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    View Ticket
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadDigitalTicket(b)}
                      title="Download Ticket"
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/30 dark:hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintFromCard(b)}
                      title="Print Ticket"
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/30 dark:hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </button>
                  </div>

                  {b.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      disabled={cancellingId === b.id}
                      onClick={() => handleCancel(b.id)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-600/15 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {cancellingId === b.id ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
