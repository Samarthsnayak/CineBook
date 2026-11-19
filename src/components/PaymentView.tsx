import { useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Building2, CreditCard, Lock, Smartphone } from 'lucide-react';
import type { AppView, SeatSlot, ShowItem } from '../types/cinebook';
import type { LiveServerClockState } from '../hooks/useServerClock';
import { api, calculatePricing, formatTime12h, showStartEpochMsIST } from '../lib/api';

interface PaymentViewProps {
  show: ShowItem;
  seats: SeatSlot[];
  serverClock: LiveServerClockState;
  onNavigate: (view: AppView) => void;
}

type PaymentMethod = 'UPI' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'NET_BANKING';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cb-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function PaymentView({ show, seats, serverClock, onNavigate }: PaymentViewProps) {
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [upiId, setUpiId] = useState('aarav@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4532 8910 2234 4242');
  const [cardExpiry, setCardExpiry] = useState('09/29');
  const [cardCvv, setCardCvv] = useState('842');
  const [bankName, setBankName] = useState('HDFC Bank');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Stable idempotency key & submit lock prevent duplicate bookings if clicked multiple times
  const submitLockRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const { subtotal, convenienceFee, taxAmount, totalAmount } = calculatePricing(seats);

  const methods: Array<{ id: PaymentMethod; label: string; icon: typeof Smartphone }> = [
    { id: 'UPI', label: 'UPI', icon: Smartphone },
    { id: 'DEBIT_CARD', label: 'Debit Card', icon: CreditCard },
    { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
    { id: 'NET_BANKING', label: 'Net Banking', icon: Building2 },
  ];

  const showExpired = serverClock.nowMs >= showStartEpochMsIST(show.show_date, show.show_time);

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || processing) return;
    if (showExpired) {
      setError('This showtime has already started and booking is closed. Please pick an upcoming show.');
      return;
    }
    setError('');

    let details = '';
    if (method === 'UPI') {
      if (!upiId.includes('@')) {
        setError('Please enter a valid UPI ID (e.g. name@okhdfcbank).');
        return;
      }
      details = upiId.trim();
    } else if (method === 'DEBIT_CARD' || method === 'CREDIT_CARD') {
      const digits = cardNumber.replace(/\s+/g, '');
      if (digits.length < 12 || !/^\d+$/.test(digits)) {
        setError('Please enter a valid 16-digit simulated card number.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
        setError('Please enter card expiry in MM/YY format.');
        return;
      }
      if (!/^\d{3,4}$/.test(cardCvv.trim())) {
        setError('Please enter a valid 3-digit CVV.');
        return;
      }
      details = `${method === 'CREDIT_CARD' ? 'Credit' : 'Debit'} •••• ${digits.slice(-4)}`;
    } else {
      details = `${bankName} Net Banking`;
    }

    submitLockRef.current = true;
    setProcessing(true);
    try {
      const checkoutRes = await api.checkout({
        showId: show.id,
        seatIds: seats.map((s) => s.id),
        paymentMethod: method,
        paymentDetails: details,
        simulateFailure,
        idempotencyKey: idempotencyKeyRef.current,
      });

      // Retrieve the saved booking directly from the database before rendering the digital ticket
      const persisted = await api.getBookingByRef(checkoutRes.booking.booking_reference);
      onNavigate({
        name: 'ticket',
        bookingRef: persisted.booking.booking_reference,
        booking: persisted.booking,
        justBooked: true,
      });
    } catch (err) {
      // Allow retry with a fresh key if payment failed intentionally or validation failed
      if (simulateFailure) {
        idempotencyKeyRef.current = generateIdempotencyKey();
      }
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      submitLockRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'summary', show, seats })}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Booking Summary
      </button>

      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
        Simulated Payment Gateway
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Academic payment simulation — no real funds are charged. Your booking and digital ticket are persisted to the database immediately upon confirmation.
      </p>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <div>
            <p className="font-semibold text-rose-900 dark:text-rose-100">Payment Unsuccessful</p>
            <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-200/90">{error}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handlePay}
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none sm:p-8"
      >
        {/* Order Breakdown Banner */}
        <div className="mb-6 border-b border-slate-200 dark:border-white/[0.08] pb-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {show.movie_title}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {show.theatre_name} ({show.theatre_city}) · {show.screen_name} · {show.show_date} at{' '}
                {formatTime12h(show.show_time)}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                Seats ({seats.length}): {seats.map((s) => `${s.seatNumber} (${s.category})`).join(', ')}
              </div>
            </div>
            <div className="font-mono text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            <span>Tickets: ₹{subtotal.toFixed(2)}</span>
            <span>Convenience Fee: ₹{convenienceFee.toFixed(2)}</span>
            <span>GST (18%): ₹{taxAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Method Tabs */}
        <div className="mb-6">
          <label className="mb-2.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Choose Payment Option
          </label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {methods.map((m) => {
              const Icon = m.icon;
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMethod(m.id);
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-600/15 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-[#151C2E] dark:text-slate-300 dark:hover:border-white/25'
                  }`}
                >
                  <Icon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Method-specific Inputs */}
        {method === 'UPI' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              UPI ID (Google Pay / PhonePe / BHIM)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@okaxis"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            />
          </div>
        )}

        {(method === 'DEBIT_CARD' || method === 'CREDIT_CARD') && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {method === 'CREDIT_CARD' ? 'Credit' : 'Debit'} Card Number (Simulated)
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4532 8910 2234 4242"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Expiry (MM/YY)
              </label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                placeholder="09/29"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                CVV
              </label>
              <input
                type="password"
                maxLength={4}
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value)}
                placeholder="842"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
              />
            </div>
          </div>
        )}

        {method === 'NET_BANKING' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Select Bank
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/15 dark:bg-[#0A0E17] dark:text-white"
            >
              <option value="HDFC Bank">HDFC Bank</option>
              <option value="ICICI Bank">ICICI Bank</option>
              <option value="State Bank of India">State Bank of India (SBI)</option>
              <option value="Axis Bank">Axis Bank</option>
              <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
            </select>
          </div>
        )}

        {/* Academic Demo Toggle for Failure Path */}
        <label className="mt-6 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-white/[0.07] dark:bg-[#0B0F19] dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(e) => setSimulateFailure(e.target.checked)}
            className="mt-0.5 accent-rose-600"
          />
          <span>
            <strong className="text-slate-900 dark:text-slate-200">Simulate Payment Failure:</strong> Check this to test failed payment handling and verify that no confirmed booking or ticket is generated.
          </span>
        </label>

        <button
          type="submit"
          disabled={processing || showExpired}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-3.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors cursor-pointer"
        >
          <Lock className="h-4 w-4" />
          {showExpired
            ? 'Showtime Closed'
            : processing
            ? 'Processing Payment & Generating Ticket...'
            : `Pay Amount and Generate Ticket (₹${totalAmount.toFixed(2)})`}
        </button>
      </form>
    </div>
  );
}
