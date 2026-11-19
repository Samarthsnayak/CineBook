import { ArrowRight, CreditCard, Percent, Sparkles, Ticket, Users } from 'lucide-react';
import type { AppView } from '../types/cinebook';

interface OffersViewProps {
  onNavigate: (view: AppView) => void;
}

const CINEMA_OFFERS = [
  {
    code: 'CINEUPI150',
    title: 'Instant ₹150 Cashback on UPI',
    subtitle: 'Valid on bookings of 2 or more Gold or Platinum tickets via any UPI app.',
    validity: 'Valid through Dec 2026',
    icon: Percent,
  },
  {
    code: 'MATINEE20',
    title: '20% Off Weekday Morning Shows',
    subtitle: 'Book shows starting before 1:00 PM Monday to Thursday across Bengaluru, Mumbai, Chennai, Hyderabad & Kochi.',
    validity: 'Mon – Thu Shows',
    icon: Ticket,
  },
  {
    code: 'CARD1PLUS1',
    title: 'Buy 1 Get 1 on Select Credit Cards',
    subtitle: 'Enjoy up to ₹350 off your second ticket on weekend IMAX and Dolby Atmos screenings.',
    validity: 'Fri – Sun Screenings',
    icon: CreditCard,
  },
  {
    code: 'GROUP4SAVE',
    title: 'Family & Squad Pack Savings',
    subtitle: 'Zero convenience fee on 4+ seats booked together for Kannada, Hindi, Tamil, Telugu & Malayalam releases.',
    validity: 'All Theatres',
    icon: Users,
  },
];

export function OffersView({ onNavigate }: OffersViewProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Cinema Offers &amp; Deals
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Exclusive ticket savings, UPI rewards, and bank card privileges for CineBook moviegoers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'movies', initialStatus: 'NOW_SHOWING' })}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors cursor-pointer sm:self-auto"
        >
          Browse Now Showing
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {CINEMA_OFFERS.map((offer) => {
          const Icon = offer.icon;
          return (
            <div
              key={offer.code}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {offer.validity}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {offer.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {offer.subtitle}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Code:{' '}
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {offer.code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'movies', initialStatus: 'NOW_SHOWING' })}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                >
                  Book Now
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
