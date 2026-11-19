import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Printer, Ticket } from 'lucide-react';
import type { AppView, BookingRecord } from '../types/cinebook';
import { api, formatBookingTimestamp, formatTime12h } from '../lib/api';
import { downloadDigitalTicket } from '../lib/ticketExport';
import { PosterArtwork } from './PosterArtwork';

interface TicketConfirmationViewProps {
  bookingRef: string;
  initialBooking?: BookingRecord;
  justBooked?: boolean;
  onNavigate: (view: AppView) => void;
}

export function TicketConfirmationView({
  bookingRef,
  initialBooking,
  justBooked = false,
  onNavigate,
}: TicketConfirmationViewProps) {
  const [booking, setBooking] = useState<BookingRecord | null>(initialBooking ?? null);
  const [loading, setLoading] = useState(!initialBooking);
  const [error, setError] = useState('');

  // Always hydrate directly from the database so displayed ticket data is authoritative
  useEffect(() => {
    let active = true;
    api
      .getBookingByRef(bookingRef)
      .then((res) => {
        if (active) {
          setBooking(res.booking);
          setError('');
        }
      })
      .catch((err) => {
        if (active && !initialBooking) {
          setError(err instanceof Error ? err.message : 'Unable to load booking ticket.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookingRef, initialBooking]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#101522]" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500 dark:text-rose-400" />
        <p className="text-slate-700 dark:text-slate-200">{error || 'Ticket not found.'}</p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'my-bookings' })}
          className="mt-5 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
        >
          Go to My Bookings
        </button>
      </div>
    );
  }

  const seatNumbers =
    booking.seats && booking.seats.length > 0
      ? booking.seats.map((s) => `${s.seat_number} (${s.category})`).join(', ')
      : booking.seat_numbers || booking.seat_summary || 'Released';

  const taxesAndCharges = (booking.convenience_fee || 0) + (booking.tax_amount || 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Clear Payment Successful Confirmation Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center no-print">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-8 w-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {justBooked ? 'Payment Successful — Ticket Confirmed' : 'Digital Movie Ticket'}
            </h1>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              {justBooked
                ? 'Your seats are locked and this ticket has been saved to your My Bookings history.'
                : 'Present this QR pass at the cinema auditorium entrance.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => downloadDigitalTicket(booking)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:border-slate-400 dark:border-white/15 dark:bg-[#101522] dark:text-white dark:hover:border-white/30 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download Ticket
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Ticket
          </button>
        </div>
      </div>

      {/* Complete 13-Field Digital Movie Ticket */}
      <div className="print-ticket overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101522] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/[0.08] dark:bg-[#151C2E]">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <Ticket className="h-4 w-4" />
            CineBook Digital Movie Pass
          </div>
          <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
            Booking ID: {booking.booking_reference}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:items-start">
          {/* Movie Poster (Field 2) */}
          <div className="lg:col-span-3">
            <div className="mx-auto max-w-[180px] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 aspect-[2/3]">
              <PosterArtwork
                title={booking.movie_title}
                posterUrl={booking.movie_poster}
                language={booking.movie_language}
                genre={booking.movie_genre}
                director={booking.movie_director}
                certificate={booking.movie_certificate}
              />
            </div>
          </div>

          {/* Ticket Details (Fields 1, 3–12) */}
          <div className="lg:col-span-6">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {booking.movie_title}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {booking.movie_language} · {booking.movie_certificate || 'UA'} · {booking.screen_format || 'Dolby Atmos'}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Theatre Name</dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                  {booking.theatre_name}
                </dd>
                <dd className="text-xs text-slate-600 dark:text-slate-400">{booking.theatre_city}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Screen Number</dt>
                <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                  {booking.screen_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Movie Show Date</dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {booking.show_date}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Showtime</dt>
                <dd className="mt-0.5 font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatTime12h(booking.show_time)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Booking Date</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                  {formatBookingTimestamp(booking.booked_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Status</dt>
                <dd
                  className={`mt-0.5 font-semibold ${
                    booking.status === 'CONFIRMED'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {booking.status} ({booking.payment_status || 'SUCCESS'})
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Selected Seats ({booking.ticket_count}{' '}
                  {booking.ticket_count === 1 ? 'Ticket' : 'Tickets'})
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {seatNumbers}
                </dd>
              </div>
            </dl>

            {/* Fare Breakdown (Fields 9, 10, 11) */}
            <div className="mt-6 space-y-1.5 border-t border-slate-200 dark:border-white/[0.08] pt-4 text-xs">
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Ticket Price</span>
                <span className="font-mono tabular-nums">₹{booking.subtotal_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>
                  Convenience Fee (₹{(booking.convenience_fee || 0).toFixed(2)}) + GST 18% (₹
                  {(booking.tax_amount || 0).toFixed(2)})
                </span>
                <span className="font-mono tabular-nums">₹{taxesAndCharges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-base font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-white/[0.06]">
                <span>Final Amount Paid</span>
                <span className="font-mono text-rose-600 dark:text-rose-400 tabular-nums">
                  ₹{booking.total_amount.toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Payment: {booking.payment_method} · Txn {booking.transaction_id}
              </div>
            </div>
          </div>

          {/* QR Code Column (Field 13) */}
          <div className="flex flex-col items-center justify-center border-t border-dashed border-slate-300 dark:border-white/15 pt-6 lg:col-span-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {booking.qrCode && (
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-transparent">
                <img
                  src={booking.qrCode}
                  alt={`QR Code for ${booking.booking_reference}`}
                  className="h-40 w-40"
                />
              </div>
            )}
            <p className="mt-3 font-mono text-xs font-bold text-slate-900 dark:text-white text-center">
              {booking.booking_reference}
            </p>
            <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
              Scan at auditorium gate
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4 no-print">
        <button
          type="button"
          onClick={() => onNavigate({ name: 'my-bookings' })}
          className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 cursor-pointer"
        >
          Open My Bookings
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'home' })}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-400 dark:border-white/15 dark:text-white dark:hover:border-white/30 cursor-pointer"
        >
          Book Another Movie
        </button>
      </div>
    </div>
  );
}
