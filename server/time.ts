export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export interface ServerClock {
  epochMs: number;
  isoUtc: string;
  timezone: string;
  date: string; // YYYY-MM-DD in timezone
  time24: string; // HH:MM:SS in timezone
  timeHHMM: string; // HH:MM in timezone
  time12: string; // h:mm:ss AM/PM in timezone
  timeShort12: string; // h:mm AM/PM in timezone
  dayName: string; // e.g., Thursday
  formattedDate: string; // e.g., Thu, 19 Nov 2026
}

export type ShowBookingStatus =
  | 'OPEN'
  | 'STARTED'
  | 'COMPLETED'
  | 'PAST_DATE'
  | 'CANCELLED'
  | 'SOLD_OUT';

export interface ShowBookingEvaluation {
  bookingStatus: ShowBookingStatus;
  isBookable: boolean;
  reason?: string;
  startEpochMs: number;
  endEpochMs: number;
  startsInMinutes: number;
}

export function normalizeTimezone(tz?: string | null): string {
  const candidate = (tz || '').trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getZonedParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
} {
  const tz = normalizeTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }
  const rawHour = Number(map.hour || '0');
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute || '0'),
    second: Number(map.second || '0'),
    weekday: map.weekday || '',
  };
}

export function formatTime12hServer(timeHHMM: string): string {
  const [hStr, mStr] = (timeHHMM || '00:00').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return timeHHMM;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function getServerClock(timezone = DEFAULT_TIMEZONE, nowMs = Date.now()): ServerClock {
  const tz = normalizeTimezone(timezone);
  const now = new Date(nowMs);
  const p = getZonedParts(now, tz);
  const dateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  const timeHHMM = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  const time24 = `${timeHHMM}:${String(p.second).padStart(2, '0')}`;

  const suffix = p.hour >= 12 ? 'PM' : 'AM';
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const time12 = `${h12}:${String(p.minute).padStart(2, '0')}:${String(p.second).padStart(2, '0')} ${suffix}`;
  const timeShort12 = `${h12}:${String(p.minute).padStart(2, '0')} ${suffix}`;

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: tz,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return {
    epochMs: nowMs,
    isoUtc: now.toISOString(),
    timezone: tz,
    date: dateStr,
    time24,
    timeHHMM,
    time12,
    timeShort12,
    dayName: p.weekday,
    formattedDate,
  };
}

/**
 * Returns YYYY-MM-DD offset by `offsetDays` relative to today in the target timezone.
 */
export function getDateOffsetInTimezone(
  offsetDays = 0,
  timezone = DEFAULT_TIMEZONE,
  nowMs = Date.now()
): string {
  const clock = getServerClock(timezone, nowMs);
  const [y, m, d] = clock.date.split('-').map(Number);
  const utcMid = new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
  const year = utcMid.getUTCFullYear();
  const month = String(utcMid.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcMid.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

export function isValidTimeString(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function timeToMinutes(timeHHMM: string): number {
  const [h, m] = timeHHMM.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Computes an end time string (HH:MM) from start time + durationMinutes.
 * Caps cleanly at 23:59 if within same day, or wraps past midnight cleanly.
 */
export function addMinutesToHHMM(startHHMM: string, durationMinutes: number): string {
  const total = (timeToMinutes(startHHMM) + Math.max(30, durationMinutes)) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converts a local wall-clock date (YYYY-MM-DD) and time (HH:MM) in a given IANA timezone
 * into exact UTC epoch milliseconds, independent of the server host's OS timezone.
 */
export function zonedDateTimeToEpochMs(
  dateStr: string,
  timeHHMM: string,
  timezone = DEFAULT_TIMEZONE
): number {
  const tz = normalizeTimezone(timezone);
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeHHMM.split(':').map(Number);

  // Fast exact path for Asia/Kolkata (fixed UTC+05:30, no DST)
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    return utcMs - (5 * 60 + 30) * 60 * 1000;
  }

  // General two-pass IANA offset resolution (handles DST transitions cleanly)
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = targetAsUtc;
  for (let i = 0; i < 2; i++) {
    const parts = getZonedParts(new Date(guess), tz);
    const guessAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    );
    const diff = targetAsUtc - guessAsUtc;
    guess += diff;
    if (diff === 0) break;
  }
  return guess;
}

/**
 * Computes exact end epoch ms for a show, supporting overnight shows (e.g. 22:30 -> 01:15).
 */
export function getShowWindowEpochMs(
  showDate: string,
  startTime: string,
  endTime: string | null | undefined,
  durationMinutes: number,
  timezone = DEFAULT_TIMEZONE
): { startEpochMs: number; endEpochMs: number; resolvedEndTime: string } {
  const startEpochMs = zonedDateTimeToEpochMs(showDate, startTime, timezone);
  const safeDuration = Math.max(60, Number(durationMinutes) || 150);
  const resolvedEndTime =
    endTime && isValidTimeString(endTime) ? endTime : addMinutesToHHMM(startTime, safeDuration);

  let endEpochMs = zonedDateTimeToEpochMs(showDate, resolvedEndTime, timezone);
  if (endEpochMs <= startEpochMs) {
    // End time wrapped past midnight into the next calendar day
    endEpochMs = startEpochMs + safeDuration * 60 * 1000;
  }
  return { startEpochMs, endEpochMs, resolvedEndTime };
}

/**
 * Strict BookMyShow-style real-time booking eligibility check.
 * Used identically by both discovery APIs and checkout transaction guards.
 */
export function computeShowBookingState(params: {
  showDate: string;
  showTime: string;
  endTime?: string | null;
  durationMinutes?: number;
  status?: string | null;
  availableSeats: number;
  timezone?: string | null;
  nowMs?: number;
}): ShowBookingEvaluation {
  const tz = normalizeTimezone(params.timezone);
  const nowMs = params.nowMs ?? Date.now();
  const todayStr = getServerClock(tz, nowMs).date;
  const { startEpochMs, endEpochMs } = getShowWindowEpochMs(
    params.showDate,
    params.showTime,
    params.endTime,
    params.durationMinutes || 150,
    tz
  );
  const startsInMinutes = Math.floor((startEpochMs - nowMs) / 60000);

  if ((params.status || 'ACTIVE').toUpperCase() === 'CANCELLED') {
    return {
      bookingStatus: 'CANCELLED',
      isBookable: false,
      reason: 'This show has been cancelled by the theatre administrator.',
      startEpochMs,
      endEpochMs,
      startsInMinutes,
    };
  }

  if (params.showDate < todayStr) {
    return {
      bookingStatus: 'PAST_DATE',
      isBookable: false,
      reason: `This showtime (${params.showDate} at ${formatTime12hServer(params.showTime)}) is in the past and cannot be booked.`,
      startEpochMs,
      endEpochMs,
      startsInMinutes,
    };
  }

  if (nowMs >= endEpochMs) {
    return {
      bookingStatus: 'COMPLETED',
      isBookable: false,
      reason: `This showtime (${formatTime12hServer(params.showTime)}) has already ended.`,
      startEpochMs,
      endEpochMs,
      startsInMinutes,
    };
  }

  if (nowMs >= startEpochMs) {
    return {
      bookingStatus: 'STARTED',
      isBookable: false,
      reason: `This showtime (${formatTime12hServer(params.showTime)}) has already started and booking is closed.`,
      startEpochMs,
      endEpochMs,
      startsInMinutes,
    };
  }

  if (params.availableSeats <= 0) {
    return {
      bookingStatus: 'SOLD_OUT',
      isBookable: false,
      reason: 'All seats for this showtime are sold out.',
      startEpochMs,
      endEpochMs,
      startsInMinutes,
    };
  }

  return {
    bookingStatus: 'OPEN',
    isBookable: true,
    startEpochMs,
    endEpochMs,
    startsInMinutes,
  };
}

/**
 * Checks whether two show windows on the same screen overlap (including optional turnaround gap).
 */
export function showWindowsOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  turnaroundMinutes = 10
): boolean {
  const padMs = Math.max(0, turnaroundMinutes) * 60 * 1000;
  return startA < endB + padMs && startB < endA + padMs;
}
