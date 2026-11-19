import type { BookingRecord } from '../types/cinebook';
import { formatBookingTimestamp, formatTime12h } from './api';

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildTicketHtml(booking: BookingRecord): string {
  const seatText =
    booking.seats && booking.seats.length > 0
      ? booking.seats.map((s) => `${s.seat_number} (${s.category})`).join(', ')
      : booking.seat_numbers || booking.seat_summary || '—';

  const chargesTotal = (booking.convenience_fee || 0) + (booking.tax_amount || 0);
  const posterSrc =
    booking.movie_poster && booking.movie_poster.startsWith('/') && typeof window !== 'undefined'
      ? `${window.location.origin}${booking.movie_poster}`
      : booking.movie_poster || '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CineBook Ticket - ${escapeHtml(booking.booking_reference)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #080a10; color: #f8fafc; padding: 32px; margin: 0; }
  .card { max-width: 780px; margin: 0 auto; background: #101522; border: 1px solid #334155; border-radius: 16px; overflow: hidden; }
  .head { background: #151c2e; padding: 18px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #263047; }
  .brand { color: #e11d48; font-weight: 800; letter-spacing: 0.06em; font-size: 13px; }
  .ref { font-family: monospace; font-size: 13px; color: #e2e8f0; font-weight: 700; }
  .body { padding: 28px; display: grid; grid-template-columns: ${posterSrc ? '120px ' : ''}1fr 195px; gap: 22px; align-items: start; }
  .poster { width: 120px; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 10px; border: 1px solid #334155; }
  h1 { margin: 0 0 6px; font-size: 24px; }
  .meta { color: #94a3b8; font-size: 13px; margin-bottom: 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .val { font-weight: 600; font-size: 14px; margin-top: 2px; color: #ffffff; }
  .totals { margin-top: 18px; padding-top: 14px; border-top: 1px dashed #334155; font-size: 13px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 6px; color: #cbd5e1; }
  .row.grand { font-weight: 700; font-size: 16px; color: #fb7185; margin-top: 8px; }
  .qr-box { text-align: center; border-left: 1px dashed #334155; padding-left: 20px; }
  .qr-img { background: #ffffff; padding: 10px; border-radius: 10px; display: inline-block; }
  @media print { body { background: #ffffff; color: #0f172a; } .card { border: 2px solid #0f172a; background: #ffffff; } .head { background: #f1f5f9; } .val, h1, .ref, .row { color: #0f172a !important; } }
</style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="brand">CINEBOOK · DIGITAL MOVIE TICKET</div>
      <div class="ref">${escapeHtml(booking.booking_reference)}</div>
    </div>
    <div class="body">
      ${posterSrc ? `<img class="poster" src="${escapeHtml(posterSrc)}" alt="${escapeHtml(booking.movie_title)} official poster" />` : ''}
      <div>
        <h1>${escapeHtml(booking.movie_title)}</h1>
        <div class="meta">${escapeHtml(booking.movie_language || '')} · ${escapeHtml(booking.movie_certificate || 'UA')} · ${escapeHtml(booking.screen_format || '')}</div>
        <div class="grid">
          <div><div class="label">Theatre</div><div class="val">${escapeHtml(booking.theatre_name)} (${escapeHtml(booking.theatre_city)})</div></div>
          <div><div class="label">Screen</div><div class="val">${escapeHtml(booking.screen_name)}</div></div>
          <div><div class="label">Show Date</div><div class="val">${escapeHtml(booking.show_date)}</div></div>
          <div><div class="label">Showtime</div><div class="val">${escapeHtml(formatTime12h(booking.show_time))}</div></div>
          <div><div class="label">Booking Date</div><div class="val">${escapeHtml(formatBookingTimestamp(booking.booked_at))}</div></div>
          <div><div class="label">Tickets</div><div class="val">${booking.ticket_count} Seat(s)</div></div>
          <div style="grid-column: span 2;"><div class="label">Selected Seats</div><div class="val">${escapeHtml(seatText)}</div></div>
        </div>
        <div class="totals">
          <div class="row"><span>Ticket Price (Subtotal)</span><span>₹${booking.subtotal_amount.toFixed(2)}</span></div>
          <div class="row"><span>Convenience Fee &amp; GST (18%)</span><span>₹${chargesTotal.toFixed(2)}</span></div>
          <div class="row grand"><span>Final Amount Paid (${escapeHtml(booking.payment_method || 'UPI')})</span><span>₹${booking.total_amount.toFixed(2)}</span></div>
        </div>
      </div>
      <div class="qr-box">
        ${booking.qrCode ? `<div class="qr-img"><img src="${booking.qrCode}" width="150" height="150" alt="Booking QR Code" /></div>` : ''}
        <div style="margin-top:10px;font-family:monospace;font-size:12px;font-weight:700;">${escapeHtml(booking.booking_reference)}</div>
        <div style="margin-top:4px;font-size:11px;color:#94a3b8;">Scan at Theatre Entrance</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function downloadDigitalTicket(booking: BookingRecord): void {
  const html = buildTicketHtml(booking);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CineBook-Ticket-${booking.booking_reference}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
