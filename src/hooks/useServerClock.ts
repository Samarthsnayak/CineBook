import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface LiveServerClockState {
  nowMs: number;
  todayDate: string; // YYYY-MM-DD in Asia/Kolkata
  dayName: string;
  formattedDate: string; // e.g., Thu, 19 Nov 2026
  time12: string; // e.g., 9:05:12 PM
  timeShort12: string; // e.g., 9:05 PM
  timezone: string;
  synced: boolean;
}

const DEFAULT_TZ = 'Asia/Kolkata';

function formatSnapshot(nowMs: number, timezone = DEFAULT_TZ, synced = false): LiveServerClockState {
  const now = new Date(nowMs);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const rawHour = Number(map.hour || '0');
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = map.minute || '00';
  const second = map.second || '00';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return {
    nowMs,
    todayDate: `${map.year}-${map.month}-${map.day}`,
    dayName: map.weekday || '',
    formattedDate,
    time12: `${h12}:${minute}:${second} ${suffix}`,
    timeShort12: `${h12}:${minute} ${suffix}`,
    timezone,
    synced,
  };
}

/**
 * Live real-time clock synchronized with `/api/time` (Asia/Kolkata IST).
 * Automatically ticks every second without requiring any page refresh.
 */
export function useServerClock(timezone = DEFAULT_TZ): LiveServerClockState {
  const [offsetMs, setOffsetMs] = useState(0);
  const [synced, setSynced] = useState(false);
  const [clock, setClock] = useState<LiveServerClockState>(() =>
    formatSnapshot(Date.now(), timezone, false)
  );

  useEffect(() => {
    let active = true;
    const syncTime = () => {
      const reqStart = Date.now();
      api
        .getServerTime(timezone)
        .then((res) => {
          if (!active) return;
          const latencyHalf = Math.round((Date.now() - reqStart) / 2);
          const serverNow = res.serverClock.epochMs + latencyHalf;
          const nextOffset = serverNow - Date.now();
          setOffsetMs(nextOffset);
          setSynced(true);
          setClock(formatSnapshot(Date.now() + nextOffset, res.serverClock.timezone || timezone, true));
        })
        .catch(() => {
          // Fall back smoothly to local Intl IST formatting if network briefly blips
        });
    };

    syncTime();
    const resyncTimer = window.setInterval(syncTime, 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(resyncTimer);
    };
  }, [timezone]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setClock(formatSnapshot(Date.now() + offsetMs, timezone, synced));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [offsetMs, timezone, synced]);

  return clock;
}
