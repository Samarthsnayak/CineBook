import 'dotenv/config';
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, initializeDatabase, generateSeatsForScreen, formatLocalDate } from './server/db.ts';
import {
  DEFAULT_TIMEZONE,
  addMinutesToHHMM,
  computeShowBookingState,
  formatTime12hServer,
  getDateOffsetInTimezone,
  getServerClock,
  getShowWindowEpochMs,
  isValidDateString,
  isValidTimeString,
  normalizeTimezone,
  showWindowsOverlap,
  zonedDateTimeToEpochMs,
} from './server/time.ts';
import { isTmdbConfigured, syncIndianMoviesFromTmdb } from './server/tmdb.ts';
import {
  MAX_POSTER_BYTES,
  getPosterStorageInfo,
  removeMoviePoster,
  resolveUploadedPoster,
  saveMoviePoster,
} from './server/posterStorage.ts';

initializeDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// Global no-store caching on dynamic API routes so seat counts, clocks, and schedules are always live
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Serve favicon cleanly to prevent 404 console noise
const publicFaviconPath = path.resolve(process.cwd(), 'public', 'favicon.svg');
app.get('/favicon.ico', (_req, res) => {
  if (fs.existsSync(publicFaviconPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(publicFaviconPath);
    return;
  }
  res.status(204).end();
});

const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_POSTER_BYTES,
    files: 1,
  },
});

const publicPostersDir = path.resolve(process.cwd(), 'public', 'posters');
if (fs.existsSync(publicPostersDir)) {
  app.use('/posters', express.static(publicPostersDir, { maxAge: '7d' }));
}

function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Persistent serving route for admin-uploaded movie posters (immutable unique filenames + anti-traversal)
app.get(
  '/uploads/posters/:filename',
  asyncHandler(async (req, res) => {
    const asset = await resolveUploadedPoster(req.params.filename);
    if (!asset) {
      res.status(404).send('Poster not found');
      return;
    }
    if (req.headers['if-none-match'] === asset.etag) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('ETag', asset.etag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(asset.buffer);
  })
);

interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'USER' | 'ADMIN';
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k] = decodeURIComponent(v.join('='));
  }
  return cookies;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string, maxAgeSeconds: number): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    String(req.headers.origin || '').startsWith('https://');
  const sameSitePart = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
  res.setHeader(
    'Set-Cookie',
    `cb_session=${encodeURIComponent(token)}; HttpOnly; Path=/; ${sameSitePart}; Max-Age=${maxAgeSeconds}`
  );
}

function createPersistentSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return token;
}

function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies['cb_session'] || null;
}

function getAuthenticatedUser(req: express.Request): SessionUser | null {
  const token = extractToken(req);
  if (!token) return null;

  const session = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as { user_id: number; expires_at: string } | undefined;

  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  const user = db
    .prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?')
    .get(session.user_id) as SessionUser | undefined;
  return user ?? null;
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  (req as express.Request & { currentUser: SessionUser }).currentUser = user;
  next();
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Administrator login required.' });
    return;
  }
  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  (req as express.Request & { currentUser: SessionUser }).currentUser = user;
  next();
}

interface RawShowRow {
  id: number;
  movie_id: number;
  screen_id: number;
  show_date: string;
  show_time: string;
  end_time: string;
  silver_price: number;
  gold_price: number;
  platinum_price: number;
  status: 'ACTIVE' | 'CANCELLED';
  movie_title: string;
  movie_poster: string;
  movie_language: string;
  movie_certificate: string;
  movie_genre?: string;
  movie_duration: number;
  screen_number: number;
  screen_name: string;
  screen_format: string;
  total_seats: number;
  theatre_id: number;
  theatre_name: string;
  theatre_city: string;
  theatre_location: string;
  theatre_address: string;
  theatre_amenities: string;
  theatre_timezone: string;
  booked_count: number;
}

function enrichShowWithLiveStatus(row: RawShowRow, nowMs = Date.now()) {
  const tz = normalizeTimezone(row.theatre_timezone);
  const totalSeats = Number(row.total_seats) || 64;
  const bookedCount = Number(row.booked_count) || 0;
  const availableSeats = Math.max(0, totalSeats - bookedCount);
  const resolvedEndTime =
    row.end_time && isValidTimeString(row.end_time)
      ? row.end_time
      : addMinutesToHHMM(row.show_time, (row.movie_duration || 150) + 15);

  const evaluation = computeShowBookingState({
    showDate: row.show_date,
    showTime: row.show_time,
    endTime: resolvedEndTime,
    durationMinutes: row.movie_duration || 150,
    status: row.status || 'ACTIVE',
    availableSeats,
    timezone: tz,
    nowMs,
  });

  return {
    ...row,
    end_time: resolvedEndTime,
    status: (row.status || 'ACTIVE') as 'ACTIVE' | 'CANCELLED',
    total_seats: totalSeats,
    booked_count: bookedCount,
    available_seats: availableSeats,
    timezone: tz,
    booking_status: evaluation.bookingStatus,
    is_bookable: evaluation.isBookable,
    booking_block_reason: evaluation.reason || null,
    starts_in_minutes: evaluation.startsInMinutes,
  };
}

// ============================================================================
// REAL-TIME SERVER CLOCK ENDPOINT
// ============================================================================

app.get('/api/time', (req, res) => {
  const requestedTz = typeof req.query.timezone === 'string' ? req.query.timezone : DEFAULT_TIMEZONE;
  const clock = getServerClock(requestedTz);
  res.json({ serverClock: clock });
});

// ============================================================================
// AUTHENTICATION ENDPOINTS (Persistent DB Sessions + Cookie + Bearer Support)
// ============================================================================

app.get('/api/auth/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  res.json({ user });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body ?? {};
  if (!name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (!phone || !/^[0-9+\-\s]{10,15}$/.test(String(phone).trim())) {
    res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    return;
  }
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)')
    .run(String(name).trim(), normalizedEmail, String(phone).trim(), hash, 'USER');

  const userId = Number(info.lastInsertRowid);
  const token = createPersistentSession(userId);

  const user: SessionUser = {
    id: userId,
    name: String(name).trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    role: 'USER',
  };

  setSessionCookie(req, res, token, 7 * 24 * 60 * 60);
  res.status(201).json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase()) as (SessionUser & { password: string }) | undefined;

  if (!row || !bcrypt.compareSync(String(password), row.password)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = createPersistentSession(row.id);

  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  };

  setSessionCookie(req, res, token, 7 * 24 * 60 * 60);
  res.json({ user, token });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  setSessionCookie(req, res, '', 0);
  res.json({ ok: true });
});

app.put('/api/auth/profile', requireAuth, (req, res) => {
  const currentUser = (req as express.Request & { currentUser: SessionUser }).currentUser;
  const { name, phone } = req.body ?? {};
  if (!name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'Please enter a valid full name (at least 2 characters).' });
    return;
  }
  if (!phone || !/^[0-9+\-\s]{10,15}$/.test(String(phone).trim())) {
    res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    return;
  }
  const cleanName = String(name).trim();
  const cleanPhone = String(phone).trim();
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(
    cleanName,
    cleanPhone,
    currentUser.id
  );
  const updated = db
    .prepare('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?')
    .get(currentUser.id);
  res.json({ user: updated, message: 'Profile updated successfully.' });
});

// ============================================================================
// PUBLIC CATALOG, CALENDAR, MULTI-CITY THEATRES, LIVE SHOWS & SEAT LAYOUT
// ============================================================================

app.get('/api/movies', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const genre = typeof req.query.genre === 'string' ? req.query.genre.trim() : '';
  const language = typeof req.query.language === 'string' ? req.query.language.trim() : '';
  const todayStr = getDateOffsetInTimezone(0, DEFAULT_TIMEZONE);

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (q) {
    clauses.push('(m.title LIKE ? OR m.genre LIKE ? OR m.cast_members LIKE ? OR m.director LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status === 'NOW_SHOWING') {
    clauses.push(
      "m.status = 'NOW_SHOWING' AND EXISTS (SELECT 1 FROM shows sh WHERE sh.movie_id = m.id AND sh.status = 'ACTIVE' AND sh.show_date >= ?)"
    );
    params.push(todayStr);
  } else if (status === 'UPCOMING') {
    clauses.push("m.status = 'UPCOMING'");
  }
  if (genre && genre !== 'ALL') {
    clauses.push('m.genre LIKE ?');
    params.push(`%${genre}%`);
  }
  if (language && language !== 'ALL') {
    clauses.push('LOWER(m.language) LIKE LOWER(?)');
    params.push(`%${language}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const movies = db
    .prepare(
      `SELECT m.*,
              (SELECT COUNT(*) FROM shows sh WHERE sh.movie_id = m.id AND sh.status = 'ACTIVE' AND sh.show_date >= ?) AS active_show_count
       FROM movies m
       ${where}
       ORDER BY
         CASE WHEN m.status = 'NOW_SHOWING' THEN 0 ELSE 1 END,
         CASE LOWER(m.language)
           WHEN 'kannada' THEN 1
           WHEN 'hindi' THEN 2
           WHEN 'tamil' THEN 3
           WHEN 'telugu' THEN 4
           WHEN 'malayalam' THEN 5
           ELSE 6
         END,
         m.release_date DESC`
    )
    .all(todayStr, ...params);

  res.json({
    movies,
    tmdbConfigured: isTmdbConfigured(),
  });
});

app.get('/api/movies/:id', (req, res) => {
  const movieId = Number(req.params.id);
  const todayStr = getDateOffsetInTimezone(0, DEFAULT_TIMEZONE);
  const movie = db
    .prepare(
      `SELECT m.*,
              (SELECT COUNT(*) FROM shows sh WHERE sh.movie_id = m.id AND sh.status = 'ACTIVE' AND sh.show_date >= ?) AS active_show_count
       FROM movies m WHERE m.id = ?`
    )
    .get(todayStr, movieId);
  if (!movie) {
    res.status(404).json({ error: 'Movie not found.' });
    return;
  }
  res.json({ movie, tmdbConfigured: isTmdbConfigured() });
});

// Calendar metadata for a specific movie (and optional city): returns upcoming dates with live bookable show counts
app.get('/api/movies/:id/calendar', (req, res) => {
  const movieId = Number(req.params.id);
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const daysRequested = Math.max(7, Math.min(31, Number(req.query.days) || 21));

  const movie = db.prepare('SELECT id, duration_minutes FROM movies WHERE id = ?').get(movieId) as
    | { id: number; duration_minutes: number }
    | undefined;
  if (!movie) {
    res.status(404).json({ error: 'Movie not found.' });
    return;
  }

  const nowMs = Date.now();
  const serverClock = getServerClock(DEFAULT_TIMEZONE, nowMs);
  const todayStr = serverClock.date;

  const clauses = ["sh.movie_id = ?", "sh.status = 'ACTIVE'", "sh.show_date >= ?"];
  const params: unknown[] = [movieId, todayStr];
  if (city && city !== 'ALL') {
    clauses.push('LOWER(t.city) = LOWER(?)');
    params.push(city);
  }

  const rows = db
    .prepare(
      `SELECT sh.id, sh.show_date, sh.show_time, sh.end_time, sh.status,
              sc.total_seats, t.id AS theatre_id, t.timezone AS theatre_timezone,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.show_id = sh.id) AS booked_count
       FROM shows sh
       JOIN screens sc ON sc.id = sh.screen_id
       JOIN theatres t ON t.id = sc.theatre_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY sh.show_date ASC, sh.show_time ASC`
    )
    .all(...params) as Array<{
    id: number;
    show_date: string;
    show_time: string;
    end_time: string;
    status: string;
    total_seats: number;
    theatre_id: number;
    theatre_timezone: string;
    booked_count: number;
  }>;

  const dateMap = new Map<
    string,
    { totalShowCount: number; bookableShowCount: number; theatres: Set<number>; bookableTheatres: Set<number> }
  >();

  for (const r of rows) {
    const avail = Math.max(0, (Number(r.total_seats) || 64) - (Number(r.booked_count) || 0));
    const evalState = computeShowBookingState({
      showDate: r.show_date,
      showTime: r.show_time,
      endTime: r.end_time,
      durationMinutes: movie.duration_minutes,
      status: r.status,
      availableSeats: avail,
      timezone: r.theatre_timezone,
      nowMs,
    });
    const entry = dateMap.get(r.show_date) || {
      totalShowCount: 0,
      bookableShowCount: 0,
      theatres: new Set<number>(),
      bookableTheatres: new Set<number>(),
    };
    entry.totalShowCount++;
    entry.theatres.add(r.theatre_id);
    if (evalState.isBookable) {
      entry.bookableShowCount++;
      entry.bookableTheatres.add(r.theatre_id);
    }
    dateMap.set(r.show_date, entry);
  }

  // Always include a contiguous range of days from today + any later scheduled dates
  const allDates = new Set<string>();
  for (let i = 0; i < daysRequested; i++) {
    allDates.add(getDateOffsetInTimezone(i, DEFAULT_TIMEZONE, nowMs));
  }
  for (const d of dateMap.keys()) {
    allDates.add(d);
  }

  const calendar = Array.from(allDates)
    .sort()
    .map((date) => {
      const info = dateMap.get(date);
      return {
        date,
        isToday: date === todayStr,
        hasShows: Boolean(info && info.totalShowCount > 0),
        hasBookableShows: Boolean(info && info.bookableShowCount > 0),
        totalShowCount: info?.totalShowCount || 0,
        bookableShowCount: info?.bookableShowCount || 0,
        theatreCount: info?.bookableTheatres.size || 0,
      };
    });

  const firstBookableDate = calendar.find((d) => d.hasBookableShows)?.date || todayStr;

  res.json({
    serverClock,
    todayDate: todayStr,
    firstBookableDate,
    calendar,
  });
});

app.get('/api/cities', (_req, res) => {
  const cityRecords = db
    .prepare(
      `SELECT c.id, c.name, c.state, c.timezone,
              (SELECT COUNT(*) FROM theatres t WHERE LOWER(t.city) = LOWER(c.name)) AS theatre_count
       FROM cities c
       ORDER BY c.name ASC`
    )
    .all() as Array<{ id: number; name: string; state: string; timezone: string; theatre_count: number }>;

  res.json({
    cities: cityRecords.map((r) => r.name),
    cityRecords,
  });
});

app.get('/api/theatres', (req, res) => {
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const theatres =
    city && city !== 'ALL'
      ? db.prepare('SELECT * FROM theatres WHERE LOWER(city) = LOWER(?) ORDER BY name ASC').all(city)
      : db.prepare('SELECT * FROM theatres ORDER BY city ASC, name ASC').all();

  const screens = db
    .prepare('SELECT * FROM screens ORDER BY theatre_id ASC, screen_number ASC, name ASC')
    .all() as Array<{
    id: number;
    theatre_id: number;
    screen_number: number;
    name: string;
    format: string;
    total_seats: number;
  }>;

  const enriched = (theatres as Array<Record<string, unknown>>).map((t) => ({
    ...t,
    screens: screens.filter((s) => s.theatre_id === t.id),
  }));

  res.json({ theatres: enriched });
});

app.get('/api/shows', (req, res) => {
  const movieId = req.query.movieId ? Number(req.query.movieId) : null;
  const theatreId = req.query.theatreId ? Number(req.query.theatreId) : null;
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const onlyBookable = req.query.onlyBookable === 'true';
  const includeCancelled = req.query.includeCancelled === 'true';

  const nowMs = Date.now();
  const serverClock = getServerClock(DEFAULT_TIMEZONE, nowMs);

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!includeCancelled) {
    clauses.push("sh.status = 'ACTIVE'");
  }
  if (movieId) {
    clauses.push('sh.movie_id = ?');
    params.push(movieId);
  }
  if (theatreId) {
    clauses.push('t.id = ?');
    params.push(theatreId);
  }
  if (city && city !== 'ALL') {
    clauses.push('LOWER(t.city) = LOWER(?)');
    params.push(city);
  }
  if (date && date !== 'ALL') {
    clauses.push('sh.show_date = ?');
    params.push(date);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rawShows = db
    .prepare(
      `SELECT sh.*,
              m.title AS movie_title, m.poster_url AS movie_poster, m.language AS movie_language,
              m.certificate AS movie_certificate, m.genre AS movie_genre, m.duration_minutes AS movie_duration,
              sc.screen_number AS screen_number, sc.name AS screen_name, sc.format AS screen_format, sc.total_seats AS total_seats,
              t.id AS theatre_id, t.name AS theatre_name, t.city AS theatre_city,
              t.location AS theatre_location, t.address AS theatre_address,
              t.amenities AS theatre_amenities, t.timezone AS theatre_timezone,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.show_id = sh.id) AS booked_count
       FROM shows sh
       JOIN movies m ON m.id = sh.movie_id
       JOIN screens sc ON sc.id = sh.screen_id
       JOIN theatres t ON t.id = sc.theatre_id
       ${where}
       ORDER BY sh.show_date ASC, t.name ASC, sh.show_time ASC`
    )
    .all(...params) as RawShowRow[];

  // Deduplicate safely by show id (and movie+screen+date+time) and attach live status
  const seenKeys = new Set<string>();
  const enriched = [];
  for (const r of rawShows) {
    const dedupKey = `${r.movie_id}:${r.screen_id}:${r.show_date}:${r.show_time}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);
    const item = enrichShowWithLiveStatus(r, nowMs);
    if (onlyBookable && !item.is_bookable) continue;
    enriched.push(item);
  }

  const availableDates = Array.from({ length: 7 }, (_, i) =>
    getDateOffsetInTimezone(i, DEFAULT_TIMEZONE, nowMs)
  );

  res.json({
    shows: enriched,
    availableDates,
    serverClock,
  });
});

app.get('/api/shows/:id/seats', (req, res) => {
  const showId = Number(req.params.id);
  const nowMs = Date.now();
  const serverClock = getServerClock(DEFAULT_TIMEZONE, nowMs);

  const rawShow = db
    .prepare(
      `SELECT sh.*,
              m.title AS movie_title, m.poster_url AS movie_poster, m.language AS movie_language,
              m.certificate AS movie_certificate, m.genre AS movie_genre, m.duration_minutes AS movie_duration,
              sc.screen_number AS screen_number, sc.name AS screen_name, sc.format AS screen_format, sc.total_seats AS total_seats,
              t.id AS theatre_id, t.name AS theatre_name, t.city AS theatre_city,
              t.location AS theatre_location, t.address AS theatre_address,
              t.amenities AS theatre_amenities, t.timezone AS theatre_timezone,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.show_id = sh.id) AS booked_count
       FROM shows sh
       JOIN movies m ON m.id = sh.movie_id
       JOIN screens sc ON sc.id = sh.screen_id
       JOIN theatres t ON t.id = sc.theatre_id
       WHERE sh.id = ?`
    )
    .get(showId) as RawShowRow | undefined;

  if (!rawShow) {
    res.status(404).json({ error: 'Show not found.' });
    return;
  }

  const show = enrichShowWithLiveStatus(rawShow, nowMs);

  const seats = db
    .prepare('SELECT * FROM seats WHERE screen_id = ? ORDER BY row_label ASC, seat_col ASC')
    .all(rawShow.screen_id) as Array<{
    id: number;
    seat_number: string;
    row_label: string;
    seat_col: number;
    category: 'SILVER' | 'GOLD' | 'PLATINUM';
  }>;

  const bookedRows = db
    .prepare('SELECT seat_id FROM booking_seats WHERE show_id = ?')
    .all(showId) as Array<{ seat_id: number }>;
  const bookedSet = new Set(bookedRows.map((r) => r.seat_id));

  const layout = seats.map((s) => ({
    id: s.id,
    seatNumber: s.seat_number,
    rowLabel: s.row_label,
    seatCol: s.seat_col,
    category: s.category,
    price:
      s.category === 'SILVER'
        ? rawShow.silver_price
        : s.category === 'GOLD'
        ? rawShow.gold_price
        : rawShow.platinum_price,
    booked: bookedSet.has(s.id),
  }));

  res.json({
    show,
    seats: layout,
    serverClock,
    isBookable: show.is_bookable,
    bookingStatus: show.booking_status,
    bookingBlockReason: show.booking_block_reason,
  });
});

// ============================================================================
// BOOKINGS, STRICT REAL-TIME VALIDATION, CONCURRENCY-SAFE CHECKOUT & QR TICKET
// ============================================================================

async function enrichBooking(bookingId: number) {
  const booking = db
    .prepare(
      `SELECT b.*,
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
              sh.show_date, sh.show_time, sh.end_time, sh.status AS show_status,
              m.id AS movie_id, m.title AS movie_title, m.poster_url AS movie_poster,
              m.language AS movie_language, m.genre AS movie_genre, m.director AS movie_director,
              m.certificate AS movie_certificate, m.duration_minutes AS movie_duration,
              sc.name AS screen_name, sc.format AS screen_format,
              t.name AS theatre_name, t.city AS theatre_city, t.address AS theatre_address,
              t.timezone AS theatre_timezone,
              p.payment_method, p.payment_details, p.transaction_id, p.status AS payment_status, p.paid_at
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN shows sh ON sh.id = b.show_id
       JOIN movies m ON m.id = sh.movie_id
       JOIN screens sc ON sc.id = sh.screen_id
       JOIN theatres t ON t.id = sc.theatre_id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.id = ?`
    )
    .get(bookingId) as Record<string, unknown> | undefined;

  if (!booking) return null;

  const seats = db
    .prepare(
      'SELECT seat_id, seat_number, category, price FROM booking_seats WHERE booking_id = ? ORDER BY seat_number ASC'
    )
    .all(bookingId) as Array<{ seat_id: number; seat_number: string; category: string; price: number }>;

  const seatText =
    seats.length > 0
      ? seats.map((s) => s.seat_number).join(', ')
      : String(booking.seat_summary || 'Released');

  const qrPayload = `CINEBOOK|REF:${booking.booking_reference}|MOVIE:${booking.movie_title}|THEATRE:${booking.theatre_name}|SCREEN:${booking.screen_name}|SHOW:${booking.show_date} ${booking.show_time}|SEATS:${seatText}|PAID:INR${booking.total_amount}`;
  const qrCode = await QRCode.toDataURL(qrPayload, {
    width: 240,
    margin: 2,
    color: { dark: '#0B0F19', light: '#FFFFFF' },
  });

  return {
    ...booking,
    seat_numbers: seatText,
    ticket_count: Number(booking.ticket_count) || seats.length || 1,
    seats,
    qrCode,
  };
}

app.post(
  '/api/bookings/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { currentUser: SessionUser }).currentUser;
    const { showId, seatIds, paymentMethod, paymentDetails, simulateFailure, idempotencyKey } =
      req.body ?? {};

    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
      res.status(400).json({ error: 'Please select at least one seat before checkout.' });
      return;
    }
    if (seatIds.length > 10) {
      res.status(400).json({ error: 'You can book up to 10 seats per transaction.' });
      return;
    }
    const validMethods = ['UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'NET_BANKING'];
    if (!validMethods.includes(paymentMethod)) {
      res.status(400).json({ error: 'Please select a valid payment method.' });
      return;
    }
    if (!paymentDetails || String(paymentDetails).trim().length < 3) {
      res.status(400).json({ error: 'Please enter valid payment details.' });
      return;
    }

    const numericSeatIds = [
      ...new Set(
        seatIds
          .map((id: unknown) => Number(id))
          .filter((n: number) => Number.isInteger(n) && n > 0)
      ),
    ];
    if (numericSeatIds.length === 0) {
      res.status(400).json({ error: 'Please provide valid seat identifiers before checkout.' });
      return;
    }

    // Prevent duplicate bookings if user double-clicks "Pay Amount and Generate Ticket"
    const cleanIdempotencyKey =
      typeof idempotencyKey === 'string' && idempotencyKey.trim().length >= 8
        ? `${user.id}:${idempotencyKey.trim()}`
        : null;

    if (cleanIdempotencyKey) {
      const existingBooking = db
        .prepare('SELECT id FROM bookings WHERE idempotency_key = ?')
        .get(cleanIdempotencyKey) as { id: number } | undefined;
      if (existingBooking) {
        const hydrated = await enrichBooking(existingBooking.id);
        res.status(200).json({ booking: hydrated, duplicatePrevented: true });
        return;
      }
    }

    // Simulate payment failure BEFORE writing any booking or locking any seat
    if (Boolean(simulateFailure)) {
      res.status(402).json({
        error:
          'Payment Failed: Transaction was declined by the simulated bank gateway. No booking or ticket was generated and no seats were reserved.',
      });
      return;
    }

    try {
      // Atomic IMMEDIATE transaction prevents race conditions & double-booking under concurrency
      const createdBookingId = db
        .transaction(() => {
          if (cleanIdempotencyKey) {
            const again = db
              .prepare('SELECT id FROM bookings WHERE idempotency_key = ?')
              .get(cleanIdempotencyKey) as { id: number } | undefined;
            if (again) return again.id;
          }

          const show = db
            .prepare(
              `SELECT sh.*, m.duration_minutes AS movie_duration, sc.total_seats AS total_seats,
                      t.timezone AS theatre_timezone,
                      (SELECT COUNT(*) FROM booking_seats bs WHERE bs.show_id = sh.id) AS booked_count
               FROM shows sh
               JOIN movies m ON m.id = sh.movie_id
               JOIN screens sc ON sc.id = sh.screen_id
               JOIN theatres t ON t.id = sc.theatre_id
               WHERE sh.id = ?`
            )
            .get(Number(showId)) as
            | {
                id: number;
                screen_id: number;
                show_date: string;
                show_time: string;
                end_time: string;
                status: string;
                silver_price: number;
                gold_price: number;
                platinum_price: number;
                movie_duration: number;
                total_seats: number;
                theatre_timezone: string;
                booked_count: number;
              }
            | undefined;

          if (!show) {
            throw new HttpError(404, 'Selected showtime does not exist.');
          }

          // Strict real-time BookMyShow-style backend validation (never relies on frontend alone)
          const avail = Math.max(0, (Number(show.total_seats) || 64) - (Number(show.booked_count) || 0));
          const evalState = computeShowBookingState({
            showDate: show.show_date,
            showTime: show.show_time,
            endTime: show.end_time,
            durationMinutes: show.movie_duration || 150,
            status: show.status || 'ACTIVE',
            availableSeats: avail,
            timezone: show.theatre_timezone,
            nowMs: Date.now(),
          });

          if (!evalState.isBookable) {
            throw new HttpError(
              evalState.bookingStatus === 'SOLD_OUT' ? 409 : 400,
              evalState.reason || 'This showtime is no longer available for booking.'
            );
          }

          const placeholders = numericSeatIds.map(() => '?').join(',');
          const conflicts = db
            .prepare(
              `SELECT seat_number FROM booking_seats WHERE show_id = ? AND seat_id IN (${placeholders})`
            )
            .all(show.id, ...numericSeatIds) as Array<{ seat_number: string }>;

          if (conflicts.length > 0) {
            throw new HttpError(
              409,
              `Seat(s) ${conflicts.map((c) => c.seat_number).join(', ')} are already booked. Please choose different seats.`
            );
          }

          const seats = db
            .prepare(
              `SELECT * FROM seats WHERE screen_id = ? AND id IN (${placeholders}) ORDER BY row_label ASC, seat_col ASC`
            )
            .all(show.screen_id, ...numericSeatIds) as Array<{
            id: number;
            seat_number: string;
            category: 'SILVER' | 'GOLD' | 'PLATINUM';
          }>;

          if (seats.length !== numericSeatIds.length) {
            throw new HttpError(400, 'One or more selected seats do not belong to this screen.');
          }

          let subtotal = 0;
          const pricedSeats = seats.map((s) => {
            const price =
              s.category === 'SILVER'
                ? show.silver_price
                : s.category === 'GOLD'
                ? show.gold_price
                : show.platinum_price;
            subtotal += price;
            return { ...s, price };
          });

          const convenienceFee = pricedSeats.length * 30;
          const taxAmount = Math.round(convenienceFee * 0.18 * 100) / 100;
          const totalAmount = Math.round((subtotal + convenienceFee + taxAmount) * 100) / 100;
          const seatSummary = pricedSeats.map((s) => `${s.seat_number} (${s.category})`).join(', ');

          const dateStamp = formatLocalDate(0, show.theatre_timezone).replace(/-/g, '');
          const ref = `CB-${dateStamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const txnId = `TXN-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

          const bInfo = db
            .prepare(
              `INSERT INTO bookings (
                booking_reference, idempotency_key, user_id, show_id, ticket_count, seat_summary,
                subtotal_amount, convenience_fee, tax_amount, total_amount, status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`
            )
            .run(
              ref,
              cleanIdempotencyKey,
              user.id,
              show.id,
              pricedSeats.length,
              seatSummary,
              subtotal,
              convenienceFee,
              taxAmount,
              totalAmount
            );

          const bookingId = Number(bInfo.lastInsertRowid);
          const insSeat = db.prepare(
            'INSERT INTO booking_seats (booking_id, show_id, seat_id, seat_number, category, price) VALUES (?, ?, ?, ?, ?, ?)'
          );
          for (const s of pricedSeats) {
            insSeat.run(bookingId, show.id, s.id, s.seat_number, s.category, s.price);
          }

          db.prepare(
            `INSERT INTO payments (booking_id, amount, payment_method, payment_details, transaction_id, status)
             VALUES (?, ?, ?, ?, ?, 'SUCCESS')`
          ).run(bookingId, totalAmount, paymentMethod, String(paymentDetails).trim(), txnId);

          return bookingId;
        })
        .immediate();

      const booking = await enrichBooking(createdBookingId);
      res.status(201).json({ booking, message: 'Payment Successful! Your ticket has been generated.' });
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to complete booking.';
      res.status(409).json({ error: message });
    }
  })
);

app.get(
  '/api/bookings/my',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { currentUser: SessionUser }).currentUser;
    const rows = db
      .prepare('SELECT id FROM bookings WHERE user_id = ? ORDER BY booked_at DESC, id DESC')
      .all(user.id) as Array<{ id: number }>;

    const bookings = await Promise.all(rows.map((r) => enrichBooking(r.id)));
    res.json({ bookings: bookings.filter(Boolean) });
  })
);

app.get(
  '/api/bookings/:ref',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { currentUser: SessionUser }).currentUser;
    const row = db
      .prepare('SELECT id, user_id FROM bookings WHERE booking_reference = ?')
      .get(req.params.ref) as { id: number; user_id: number } | undefined;

    if (!row) {
      res.status(404).json({ error: 'Booking not found.' });
      return;
    }
    if (user.role !== 'ADMIN' && row.user_id !== user.id) {
      res.status(403).json({ error: 'You do not have access to this ticket.' });
      return;
    }

    const booking = await enrichBooking(row.id);
    res.json({ booking });
  })
);

app.post(
  '/api/bookings/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { currentUser: SessionUser }).currentUser;
    const bookingId = Number(req.params.id);

    try {
      db.transaction(() => {
        const booking = db
          .prepare(
            `SELECT b.*, sh.show_date, sh.show_time, t.timezone AS theatre_timezone
             FROM bookings b
             JOIN shows sh ON sh.id = b.show_id
             JOIN screens sc ON sc.id = sh.screen_id
             JOIN theatres t ON t.id = sc.theatre_id
             WHERE b.id = ?`
          )
          .get(bookingId) as
          | {
              id: number;
              user_id: number;
              status: string;
              show_date: string;
              show_time: string;
              theatre_timezone: string;
            }
          | undefined;

        if (!booking) throw new Error('Booking not found.');
        if (user.role !== 'ADMIN' && booking.user_id !== user.id) {
          throw new Error('You are not authorized to cancel this booking.');
        }
        if (booking.status === 'CANCELLED') {
          throw new Error('This booking has already been cancelled.');
        }

        const showTimestamp = zonedDateTimeToEpochMs(
          booking.show_date,
          booking.show_time,
          booking.theatre_timezone
        );
        const twoHoursMs = 2 * 60 * 60 * 1000;
        if (user.role !== 'ADMIN' && showTimestamp - Date.now() < twoHoursMs) {
          throw new Error(
            'Cancellation Policy: Tickets can only be cancelled at least 2 hours before showtime.'
          );
        }

        db.prepare(
          "UPDATE bookings SET status = 'CANCELLED', cancelled_at = datetime('now') WHERE id = ?"
        ).run(bookingId);
        db.prepare('DELETE FROM booking_seats WHERE booking_id = ?').run(bookingId);
        db.prepare("UPDATE payments SET status = 'REFUNDED' WHERE booking_id = ?").run(bookingId);
      }).immediate();

      const updated = await enrichBooking(bookingId);
      res.json({
        booking: updated,
        message: 'Booking cancelled. Seats released and simulated refund issued.',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to cancel booking.' });
    }
  })
);

// ============================================================================
// ADMIN DASHBOARD, CITIES, THEATRES, SCREENS, DYNAMIC SHOWS & TMDB SYNC
// ============================================================================

app.post(
  '/api/admin/tmdb/sync',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    try {
      const result = await syncIndianMoviesFromTmdb();
      res.json({
        ...result,
        message: `Synced ${result.syncedCount} Indian cinema titles from TMDB (${result.languagesSynced.join(', ')}).`,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to sync movies from TMDB.',
      });
    }
  })
);

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const revenueRow = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) AS total FROM bookings WHERE status = 'CONFIRMED'")
    .get() as { total: number };
  const confirmedCount = (
    db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE status = 'CONFIRMED'").get() as { c: number }
  ).c;
  const cancelledCount = (
    db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE status = 'CANCELLED'").get() as { c: number }
  ).c;
  const movieCount = (db.prepare('SELECT COUNT(*) AS c FROM movies').get() as { c: number }).c;
  const cityCount = (db.prepare('SELECT COUNT(*) AS c FROM cities').get() as { c: number }).c;
  const theatreCount = (db.prepare('SELECT COUNT(*) AS c FROM theatres').get() as { c: number }).c;
  const showCount = (
    db.prepare("SELECT COUNT(*) AS c FROM shows WHERE status = 'ACTIVE'").get() as { c: number }
  ).c;
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const seatsSold = (db.prepare('SELECT COUNT(*) AS c FROM booking_seats').get() as { c: number }).c;

  const bookings = db
    .prepare(
      `SELECT b.*, u.name AS user_name, u.email AS user_email,
              m.title AS movie_title, sh.show_date, sh.show_time,
              t.name AS theatre_name, t.city AS theatre_city, sc.name AS screen_name,
              p.payment_method, p.status AS payment_status,
              COALESCE(
                (SELECT GROUP_CONCAT(seat_number, ', ') FROM booking_seats bs WHERE bs.booking_id = b.id),
                b.seat_summary
              ) AS seat_numbers
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN shows sh ON sh.id = b.show_id
       JOIN movies m ON m.id = sh.movie_id
       JOIN screens sc ON sc.id = sh.screen_id
       JOIN theatres t ON t.id = sc.theatre_id
       LEFT JOIN payments p ON p.booking_id = b.id
       ORDER BY b.booked_at DESC, b.id DESC`
    )
    .all();

  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS booking_count
       FROM users u ORDER BY u.created_at DESC`
    )
    .all();

  const screens = db
    .prepare(
      `SELECT sc.*, t.name AS theatre_name, t.city AS theatre_city
       FROM screens sc JOIN theatres t ON t.id = sc.theatre_id
       ORDER BY t.city ASC, t.name ASC, sc.screen_number ASC, sc.name ASC`
    )
    .all();

  const cities = db
    .prepare(
      `SELECT c.id, c.name, c.state, c.timezone,
              (SELECT COUNT(*) FROM theatres t WHERE LOWER(t.city) = LOWER(c.name)) AS theatre_count
       FROM cities c
       ORDER BY c.name ASC`
    )
    .all();

  res.json({
    tmdbConfigured: isTmdbConfigured(),
    posterStorage: getPosterStorageInfo(),
    serverClock: getServerClock(DEFAULT_TIMEZONE),
    stats: {
      totalRevenue: revenueRow.total,
      confirmedBookings: confirmedCount,
      cancelledBookings: cancelledCount,
      totalMovies: movieCount,
      totalCities: cityCount,
      totalTheatres: theatreCount,
      totalShows: showCount,
      totalUsers: userCount,
      seatsSold,
    },
    cities,
    bookings,
    users,
    screens,
  });
});

// ============================================================================
// ADMIN-ONLY MOVIE POSTER MANAGEMENT APIs
// ============================================================================

app.get('/api/admin/posters', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.title, m.language, m.genre, m.director, m.certificate, m.release_date,
              m.status, m.poster_url, m.poster_managed_by_admin, m.poster_updated_at,
              m.poster_storage_provider,
              mp.original_filename AS poster_original_filename,
              mp.mime_type AS poster_mime_type,
              mp.byte_size AS poster_byte_size,
              mp.storage_key AS poster_storage_key,
              mp.updated_at AS poster_uploaded_at
       FROM movies m
       LEFT JOIN movie_posters mp ON mp.movie_id = m.id
       ORDER BY
         CASE WHEN m.status = 'NOW_SHOWING' THEN 0 ELSE 1 END,
         m.title ASC`
    )
    .all();

  res.json({
    storage: getPosterStorageInfo(),
    maxUploadBytes: MAX_POSTER_BYTES,
    movies: rows,
  });
});

function handlePosterMultipart(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  posterUpload.single('poster')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Poster image exceeds the 5 MB maximum upload limit.' });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to process uploaded poster file.',
    });
  });
}

app.post(
  '/api/admin/movies/:id/poster',
  requireAdmin,
  handlePosterMultipart,
  asyncHandler(async (req, res) => {
    const adminUser = (req as express.Request & { currentUser: SessionUser }).currentUser;
    const movieId = Number(req.params.id);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      res.status(400).json({ error: 'Invalid movie ID.' });
      return;
    }

    const uploadedFile = req.file;
    if (!uploadedFile || !uploadedFile.buffer) {
      res.status(400).json({ error: 'Please select a JPG, PNG, or WEBP poster image to upload.' });
      return;
    }

    try {
      const result = await saveMoviePoster({
        movieId,
        buffer: uploadedFile.buffer,
        claimedMimeType: uploadedFile.mimetype,
        originalFilename: uploadedFile.originalname,
        adminUserId: adminUser.id,
      });

      const updatedMovie = db
        .prepare(
          `SELECT m.*, (SELECT COUNT(*) FROM shows sh WHERE sh.movie_id = m.id AND sh.status = 'ACTIVE') AS active_show_count
           FROM movies m WHERE m.id = ?`
        )
        .get(movieId);

      res.json({
        movie: updatedMovie,
        posterUrl: result.posterUrl,
        metadata: result.metadata,
        message: 'Movie poster uploaded and updated across CineBook.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload movie poster.';
      const statusCode = msg === 'Movie not found.' ? 404 : 400;
      res.status(statusCode).json({ error: msg });
    }
  })
);

app.delete(
  '/api/admin/movies/:id/poster',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const movieId = Number(req.params.id);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      res.status(400).json({ error: 'Invalid movie ID.' });
      return;
    }

    try {
      await removeMoviePoster(movieId);
      const updatedMovie = db
        .prepare(
          `SELECT m.*, (SELECT COUNT(*) FROM shows sh WHERE sh.movie_id = m.id AND sh.status = 'ACTIVE') AS active_show_count
           FROM movies m WHERE m.id = ?`
        )
        .get(movieId);

      res.json({
        movie: updatedMovie,
        message: 'Movie poster removed successfully.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove movie poster.';
      res.status(msg === 'Movie not found.' ? 404 : 400).json({ error: msg });
    }
  })
);

// ============================================================================
// ADMIN MOVIES CRUD
// ============================================================================

app.post('/api/admin/movies', requireAdmin, (req, res) => {
  const {
    title,
    description,
    cast_members,
    director,
    genre,
    language,
    duration_minutes,
    rating,
    certificate,
    release_date,
    status,
    poster_url,
  } = req.body ?? {};

  if (!title || !description || !director || !genre || !language) {
    res.status(400).json({ error: 'Please fill in all required movie fields.' });
    return;
  }

  const parsedRating = rating !== undefined && rating !== '' && rating !== null ? Number(rating) : null;
  if (parsedRating !== null && (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 10)) {
    res.status(400).json({ error: 'Rating must be between 0 and 10.' });
    return;
  }
  const duration = Number(duration_minutes) || 140;
  if (!Number.isFinite(duration) || duration < 45 || duration > 360) {
    res.status(400).json({ error: 'Duration must be between 45 and 360 minutes.' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO movies (title, description, cast_members, director, genre, language, duration_minutes, rating, certificate, release_date, status, poster_url, data_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN')`
    )
    .run(
      String(title).trim(),
      String(description).trim(),
      String(cast_members || 'Cast TBA').trim(),
      String(director).trim(),
      String(genre).trim(),
      String(language).trim(),
      Math.round(duration),
      parsedRating,
      String(certificate || 'UA'),
      String(release_date || formatLocalDate(0)),
      status === 'UPCOMING' ? 'UPCOMING' : 'NOW_SHOWING',
      String(poster_url || '').trim()
    );

  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ movie });
});

app.put('/api/admin/movies/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Movie not found.' });
    return;
  }

  const body = req.body ?? {};
  const nextTitle = body.title !== undefined ? String(body.title).trim() : String(existing.title);
  const nextDesc =
    body.description !== undefined ? String(body.description).trim() : String(existing.description);
  const nextCast =
    body.cast_members !== undefined ? String(body.cast_members).trim() : String(existing.cast_members);
  const nextDirector =
    body.director !== undefined ? String(body.director).trim() : String(existing.director);
  const nextGenre = body.genre !== undefined ? String(body.genre).trim() : String(existing.genre);
  const nextLanguage =
    body.language !== undefined ? String(body.language).trim() : String(existing.language);
  const nextDuration =
    body.duration_minutes !== undefined ? Number(body.duration_minutes) : Number(existing.duration_minutes);
  const nextRating =
    body.rating !== undefined
      ? body.rating === '' || body.rating === null
        ? null
        : Number(body.rating)
      : (existing.rating as number | null);
  const nextCertificate =
    body.certificate !== undefined ? String(body.certificate || 'UA').trim() : String(existing.certificate);
  const nextReleaseDate =
    body.release_date !== undefined ? String(body.release_date).trim() : String(existing.release_date);
  const nextStatus =
    body.status !== undefined
      ? body.status === 'UPCOMING'
        ? 'UPCOMING'
        : 'NOW_SHOWING'
      : String(existing.status);
  const nextPosterUrl =
    body.poster_url !== undefined ? String(body.poster_url || '').trim() : String(existing.poster_url || '');

  if (!nextTitle || !nextDesc || !nextDirector || !nextGenre || !nextLanguage) {
    res.status(400).json({ error: 'Title, synopsis, director, genre, and language cannot be empty.' });
    return;
  }
  if (!Number.isFinite(nextDuration) || nextDuration < 45 || nextDuration > 360) {
    res.status(400).json({ error: 'Duration must be a valid number between 45 and 360 minutes.' });
    return;
  }
  if (nextRating !== null && (!Number.isFinite(nextRating) || nextRating < 0 || nextRating > 10)) {
    res.status(400).json({ error: 'Rating must be between 0 and 10.' });
    return;
  }

  db.prepare(
    `UPDATE movies
     SET title = ?, description = ?, cast_members = ?, director = ?, genre = ?, language = ?,
         duration_minutes = ?, rating = ?, certificate = ?, release_date = ?, status = ?, poster_url = ?
     WHERE id = ?`
  ).run(
    nextTitle,
    nextDesc,
    nextCast || 'Cast TBA',
    nextDirector,
    nextGenre,
    nextLanguage,
    Math.round(nextDuration),
    nextRating,
    nextCertificate,
    nextReleaseDate,
    nextStatus,
    nextPosterUrl,
    id
  );

  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  res.json({ movie });
});

app.delete(
  '/api/admin/movies/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM movies WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Movie not found.' });
      return;
    }
    try {
      await removeMoviePoster(id);
    } catch {
      // Poster may not have been uploaded; continue deleting movie cleanly
    }
    db.prepare('DELETE FROM movies WHERE id = ?').run(id);
    res.json({ deleted: true });
  })
);

// ============================================================================
// ADMIN CITIES CRUD
// ============================================================================

app.get('/api/admin/cities', requireAdmin, (_req, res) => {
  const cities = db
    .prepare(
      `SELECT c.id, c.name, c.state, c.timezone, c.created_at,
              (SELECT COUNT(*) FROM theatres t WHERE LOWER(t.city) = LOWER(c.name)) AS theatre_count
       FROM cities c
       ORDER BY c.name ASC`
    )
    .all();
  res.json({ cities });
});

app.post('/api/admin/cities', requireAdmin, (req, res) => {
  const { name, state, timezone } = req.body ?? {};
  if (!name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'City name must be at least 2 characters.' });
    return;
  }
  const cleanName = String(name).trim();
  const cleanState = String(state || '').trim();
  const cleanTz = normalizeTimezone(timezone);

  const dup = db.prepare('SELECT id FROM cities WHERE LOWER(name) = LOWER(?)').get(cleanName);
  if (dup) {
    res.status(409).json({ error: `City "${cleanName}" already exists.` });
    return;
  }

  const info = db
    .prepare('INSERT INTO cities (name, state, timezone) VALUES (?, ?, ?)')
    .run(cleanName, cleanState, cleanTz);
  const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ city, message: `Added city "${cleanName}".` });
});

app.put('/api/admin/cities/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM cities WHERE id = ?').get(id) as
    | { id: number; name: string; state: string; timezone: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'City not found.' });
    return;
  }

  const { name, state, timezone } = req.body ?? {};
  const cleanName = name !== undefined ? String(name).trim() : existing.name;
  const cleanState = state !== undefined ? String(state).trim() : existing.state;
  const cleanTz = timezone !== undefined ? normalizeTimezone(timezone) : existing.timezone;

  if (cleanName.length < 2) {
    res.status(400).json({ error: 'City name must be at least 2 characters.' });
    return;
  }

  const dup = db
    .prepare('SELECT id FROM cities WHERE LOWER(name) = LOWER(?) AND id != ?')
    .get(cleanName, id);
  if (dup) {
    res.status(409).json({ error: `Another city named "${cleanName}" already exists.` });
    return;
  }

  db.transaction(() => {
    db.prepare('UPDATE cities SET name = ?, state = ?, timezone = ? WHERE id = ?').run(
      cleanName,
      cleanState,
      cleanTz,
      id
    );
    if (cleanName.toLowerCase() !== existing.name.toLowerCase() || cleanTz !== existing.timezone) {
      db.prepare('UPDATE theatres SET city = ?, timezone = ? WHERE LOWER(city) = LOWER(?)').run(
        cleanName,
        cleanTz,
        existing.name
      );
    }
  })();

  const city = db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
  res.json({ city, message: `Updated city "${cleanName}".` });
});

app.delete('/api/admin/cities/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM cities WHERE id = ?').get(id) as
    | { id: number; name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'City not found.' });
    return;
  }
  const theatreCount = (
    db.prepare('SELECT COUNT(*) as c FROM theatres WHERE LOWER(city) = LOWER(?)').get(existing.name) as {
      c: number;
    }
  ).c;
  if (theatreCount > 0) {
    res.status(409).json({
      error: `Cannot delete "${existing.name}" while ${theatreCount} theatre(s) are assigned to it. Reassign or remove those theatres first.`,
    });
    return;
  }
  db.prepare('DELETE FROM cities WHERE id = ?').run(id);
  res.json({ deleted: true, message: `Deleted city "${existing.name}".` });
});

// ============================================================================
// ADMIN THEATRES & SCREENS CRUD (WITH CONFIGURABLE SEAT CAPACITY)
// ============================================================================

app.post('/api/admin/theatres', requireAdmin, (req, res) => {
  const { name, city, location, address, amenities, timezone, initial_seats } = req.body ?? {};
  if (!name || !city || !address) {
    res.status(400).json({ error: 'Theatre name, city, and address are required.' });
    return;
  }
  const cleanName = String(name).trim();
  const cleanCity = String(city).trim();
  const cleanLocation = String(location || cleanCity).trim();
  const cleanAddress = String(address).trim();
  const cleanAmenities = String(amenities || 'Dolby Atmos · 4K Laser · M-Ticket').trim();
  const cleanTz = normalizeTimezone(timezone);
  const seatCap = Math.max(24, Math.min(160, Number(initial_seats) || 64));

  const dup = db
    .prepare('SELECT id FROM theatres WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)')
    .get(cleanName, cleanCity);
  if (dup) {
    res.status(409).json({ error: `A theatre named "${cleanName}" already exists in ${cleanCity}.` });
    return;
  }

  db.prepare('INSERT OR IGNORE INTO cities (name, state, timezone) VALUES (?, ?, ?)').run(
    cleanCity,
    '',
    cleanTz
  );

  const info = db
    .prepare(
      'INSERT INTO theatres (name, city, location, address, amenities, timezone) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(cleanName, cleanCity, cleanLocation, cleanAddress, cleanAmenities, cleanTz);
  const theatreId = Number(info.lastInsertRowid);
  const scInfo = db
    .prepare(
      'INSERT INTO screens (theatre_id, screen_number, name, format, total_seats) VALUES (?, 1, ?, ?, ?)'
    )
    .run(theatreId, 'Screen 1 · Atmos', 'Dolby Atmos', seatCap);
  const actualSeats = generateSeatsForScreen(Number(scInfo.lastInsertRowid), seatCap);

  const theatre = db.prepare('SELECT * FROM theatres WHERE id = ?').get(theatreId);
  res.status(201).json({
    id: theatreId,
    theatre,
    message: `Added theatre "${cleanName}" in ${cleanCity} with Screen 1 (${actualSeats} seats).`,
  });
});

app.put('/api/admin/theatres/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM theatres WHERE id = ?').get(id) as
    | { id: number; name: string; city: string; location: string; address: string; amenities: string; timezone: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Theatre not found.' });
    return;
  }

  const { name, city, location, address, amenities, timezone } = req.body ?? {};
  const cleanName = name !== undefined ? String(name).trim() : existing.name;
  const cleanCity = city !== undefined ? String(city).trim() : existing.city;
  const cleanLocation = location !== undefined ? String(location).trim() : existing.location;
  const cleanAddress = address !== undefined ? String(address).trim() : existing.address;
  const cleanAmenities = amenities !== undefined ? String(amenities).trim() : existing.amenities;
  const cleanTz = timezone !== undefined ? normalizeTimezone(timezone) : existing.timezone;

  if (!cleanName || !cleanCity || !cleanAddress) {
    res.status(400).json({ error: 'Theatre name, city, and address cannot be empty.' });
    return;
  }

  db.prepare('INSERT OR IGNORE INTO cities (name, state, timezone) VALUES (?, ?, ?)').run(
    cleanCity,
    '',
    cleanTz
  );
  db.prepare(
    'UPDATE theatres SET name = ?, city = ?, location = ?, address = ?, amenities = ?, timezone = ? WHERE id = ?'
  ).run(cleanName, cleanCity, cleanLocation || cleanCity, cleanAddress, cleanAmenities, cleanTz, id);

  const theatre = db.prepare('SELECT * FROM theatres WHERE id = ?').get(id);
  res.json({ theatre, message: `Updated theatre "${cleanName}".` });
});

app.delete('/api/admin/theatres/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, name FROM theatres WHERE id = ?').get(id) as
    | { id: number; name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Theatre not found.' });
    return;
  }
  const activeBookings = (
    db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM bookings b
         JOIN shows sh ON sh.id = b.show_id
         JOIN screens sc ON sc.id = sh.screen_id
         WHERE sc.theatre_id = ? AND b.status = 'CONFIRMED'`
      )
      .get(id) as { c: number }
  ).c;
  if (activeBookings > 0) {
    res.status(409).json({
      error: `Cannot delete "${existing.name}" because it has ${activeBookings} confirmed booking(s).`,
    });
    return;
  }
  db.prepare('DELETE FROM theatres WHERE id = ?').run(id);
  res.json({ deleted: true, message: `Deleted theatre "${existing.name}".` });
});

app.post('/api/admin/screens', requireAdmin, (req, res) => {
  const { theatre_id, name, format, screen_number, total_seats } = req.body ?? {};
  const theatreId = Number(theatre_id);
  if (!theatreId || !name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'Valid theatre and screen name are required.' });
    return;
  }
  const theatre = db.prepare('SELECT id FROM theatres WHERE id = ?').get(theatreId);
  if (!theatre) {
    res.status(404).json({ error: 'Selected theatre does not exist.' });
    return;
  }

  const maxNumRow = db
    .prepare('SELECT COALESCE(MAX(screen_number), 0) AS m FROM screens WHERE theatre_id = ?')
    .get(theatreId) as { m: number };
  const resolvedNum = Number(screen_number) > 0 ? Number(screen_number) : maxNumRow.m + 1;
  const seatCap = Math.max(24, Math.min(160, Number(total_seats) || 64));

  const scInfo = db
    .prepare(
      'INSERT INTO screens (theatre_id, screen_number, name, format, total_seats) VALUES (?, ?, ?, ?, ?)'
    )
    .run(theatreId, resolvedNum, String(name).trim(), String(format || 'Dolby Atmos').trim(), seatCap);
  const screenId = Number(scInfo.lastInsertRowid);
  const actualSeats = generateSeatsForScreen(screenId, seatCap);
  const screen = db.prepare('SELECT * FROM screens WHERE id = ?').get(screenId);
  res.status(201).json({
    id: screenId,
    screen,
    message: `Added "${String(name).trim()}" with ${actualSeats} Silver/Gold/Platinum seats.`,
  });
});

app.put('/api/admin/screens/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as
    | { id: number; name: string; format: string; screen_number: number; total_seats: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Screen not found.' });
    return;
  }

  const { name, format, screen_number } = req.body ?? {};
  const cleanName = name !== undefined ? String(name).trim() : existing.name;
  const cleanFormat = format !== undefined ? String(format).trim() : existing.format;
  const cleanNum = Number(screen_number) > 0 ? Number(screen_number) : existing.screen_number;

  if (!cleanName) {
    res.status(400).json({ error: 'Screen name cannot be empty.' });
    return;
  }

  db.prepare('UPDATE screens SET name = ?, format = ?, screen_number = ? WHERE id = ?').run(
    cleanName,
    cleanFormat || 'Dolby Atmos',
    cleanNum,
    id
  );
  const screen = db.prepare('SELECT * FROM screens WHERE id = ?').get(id);
  res.json({ screen, message: `Updated screen "${cleanName}".` });
});

app.delete('/api/admin/screens/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, name FROM screens WHERE id = ?').get(id) as
    | { id: number; name: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Screen not found.' });
    return;
  }
  const activeBookings = (
    db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM bookings b
         JOIN shows sh ON sh.id = b.show_id
         WHERE sh.screen_id = ? AND b.status = 'CONFIRMED'`
      )
      .get(id) as { c: number }
  ).c;
  if (activeBookings > 0) {
    res.status(409).json({
      error: `Cannot delete "${existing.name}" because it has ${activeBookings} confirmed booking(s).`,
    });
    return;
  }
  db.prepare('DELETE FROM screens WHERE id = ?').run(id);
  res.json({ deleted: true, message: `Deleted screen "${existing.name}".` });
});

// ============================================================================
// ADMIN DYNAMIC SHOW SCHEDULE MANAGEMENT (OVERLAP & PAST-TIME VALIDATION)
// ============================================================================

app.get('/api/admin/shows', requireAdmin, (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const movieId = req.query.movieId ? Number(req.query.movieId) : null;

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (date && date !== 'ALL') {
    clauses.push('sh.show_date = ?');
    params.push(date);
  }
  if (city && city !== 'ALL') {
    clauses.push('LOWER(t.city) = LOWER(?)');
    params.push(city);
  }
  if (movieId) {
    clauses.push('sh.movie_id = ?');
    params.push(movieId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const nowMs = Date.now();
  const rows = db
    .prepare(
      `SELECT sh.*,
              m.title AS movie_title, m.poster_url AS movie_poster, m.language AS movie_language,
              m.certificate AS movie_certificate, m.genre AS movie_genre, m.duration_minutes AS movie_duration,
              sc.screen_number AS screen_number, sc.name AS screen_name, sc.format AS screen_format, sc.total_seats AS total_seats,
              t.id AS theatre_id, t.name AS theatre_name, t.city AS theatre_city,
              t.location AS theatre_location, t.address AS theatre_address,
              t.amenities AS theatre_amenities, t.timezone AS theatre_timezone,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.show_id = sh.id) AS booked_count
       FROM shows sh
       JOIN movies m ON m.id = sh.movie_id
       JOIN screens sc ON sc.id = sh.screen_id
       JOIN theatres t ON t.id = sc.theatre_id
       ${where}
       ORDER BY sh.show_date ASC, t.city ASC, t.name ASC, sh.show_time ASC`
    )
    .all(...params) as RawShowRow[];

  res.json({
    shows: rows.map((r) => enrichShowWithLiveStatus(r, nowMs)),
    serverClock: getServerClock(DEFAULT_TIMEZONE, nowMs),
  });
});

function validateAndCheckShowOverlap(params: {
  movieId: number;
  screenId: number;
  showDate: string;
  showTime: string;
  endTime?: string;
  excludeShowId?: number;
  allowPast?: boolean;
}): { resolvedEndTime: string; timezone: string } {
  if (!isValidDateString(params.showDate)) {
    throw new HttpError(400, 'Please enter a valid show date (YYYY-MM-DD).');
  }
  if (!isValidTimeString(params.showTime)) {
    throw new HttpError(400, 'Please enter a valid show start time (HH:MM in 24-hour format).');
  }

  const movie = db
    .prepare('SELECT id, title, duration_minutes FROM movies WHERE id = ?')
    .get(params.movieId) as { id: number; title: string; duration_minutes: number } | undefined;
  if (!movie) {
    throw new HttpError(404, 'Selected movie does not exist.');
  }

  const screen = db
    .prepare(
      `SELECT sc.id, sc.name, t.name AS theatre_name, t.timezone AS theatre_timezone
       FROM screens sc
       JOIN theatres t ON t.id = sc.theatre_id
       WHERE sc.id = ?`
    )
    .get(params.screenId) as
    | { id: number; name: string; theatre_name: string; theatre_timezone: string }
    | undefined;
  if (!screen) {
    throw new HttpError(404, 'Selected theatre screen does not exist.');
  }

  const tz = normalizeTimezone(screen.theatre_timezone);
  const startEpochMs = zonedDateTimeToEpochMs(params.showDate, params.showTime, tz);
  if (!params.allowPast && startEpochMs <= Date.now()) {
    throw new HttpError(
      400,
      `Cannot schedule a show in the past (${params.showDate} ${formatTime12hServer(params.showTime)} ${tz}). Choose an upcoming date and time.`
    );
  }

  const resolvedEndTime =
    params.endTime && isValidTimeString(params.endTime)
      ? params.endTime
      : addMinutesToHHMM(params.showTime, (movie.duration_minutes || 150) + 15);

  const candidateWin = getShowWindowEpochMs(
    params.showDate,
    params.showTime,
    resolvedEndTime,
    (movie.duration_minutes || 150) + 15,
    tz
  );

  // Check exact duplicate + screen schedule overlap with all ACTIVE shows on the same screen & date
  const sameDayShows = db
    .prepare(
      `SELECT sh.id, sh.movie_id, sh.show_time, sh.end_time, m.title AS movie_title, m.duration_minutes
       FROM shows sh
       JOIN movies m ON m.id = sh.movie_id
       WHERE sh.screen_id = ? AND sh.show_date = ? AND sh.status = 'ACTIVE'
         ${params.excludeShowId ? 'AND sh.id != ?' : ''}`
    )
    .all(
      ...(params.excludeShowId
        ? [params.screenId, params.showDate, params.excludeShowId]
        : [params.screenId, params.showDate])
    ) as Array<{
    id: number;
    movie_id: number;
    show_time: string;
    end_time: string;
    movie_title: string;
    duration_minutes: number;
  }>;

  for (const existing of sameDayShows) {
    if (existing.show_time === params.showTime) {
      throw new HttpError(
        409,
        `Duplicate schedule conflict: ${screen.theatre_name} (${screen.name}) already has "${existing.movie_title}" scheduled at ${formatTime12hServer(existing.show_time)} on ${params.showDate}.`
      );
    }
    const existingWin = getShowWindowEpochMs(
      params.showDate,
      existing.show_time,
      existing.end_time,
      (existing.duration_minutes || 150) + 15,
      tz
    );
    if (
      showWindowsOverlap(
        candidateWin.startEpochMs,
        candidateWin.endEpochMs,
        existingWin.startEpochMs,
        existingWin.endEpochMs,
        10
      )
    ) {
      throw new HttpError(
        409,
        `Screen schedule overlap: "${existing.movie_title}" runs ${formatTime12hServer(existing.show_time)} – ${formatTime12hServer(existingWin.resolvedEndTime)} on ${screen.name}. Leave at least a 10-minute turnaround buffer.`
      );
    }
  }

  return { resolvedEndTime, timezone: tz };
}

app.post('/api/admin/shows', requireAdmin, (req, res) => {
  const {
    movie_id,
    screen_id,
    show_date,
    show_time,
    end_time,
    silver_price,
    gold_price,
    platinum_price,
  } = req.body ?? {};

  if (!movie_id || !screen_id || !show_date || !show_time) {
    res.status(400).json({ error: 'Movie, screen, date, and start time are required.' });
    return;
  }

  const silver = Number(silver_price) || 200;
  const gold = Number(gold_price) || 320;
  const platinum = Number(platinum_price) || 480;
  if (silver < 50 || gold < 50 || platinum < 50) {
    res.status(400).json({ error: 'Ticket prices must be at least ₹50 for every tier.' });
    return;
  }

  try {
    const { resolvedEndTime } = validateAndCheckShowOverlap({
      movieId: Number(movie_id),
      screenId: Number(screen_id),
      showDate: String(show_date).trim(),
      showTime: String(show_time).trim(),
      endTime: end_time ? String(end_time).trim() : undefined,
    });

    const info = db
      .prepare(
        `INSERT INTO shows (movie_id, screen_id, show_date, show_time, end_time, silver_price, gold_price, platinum_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`
      )
      .run(
        Number(movie_id),
        Number(screen_id),
        String(show_date).trim(),
        String(show_time).trim(),
        resolvedEndTime,
        silver,
        gold,
        platinum
      );
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      end_time: resolvedEndTime,
      message: 'Showtime scheduled successfully.',
    });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to schedule show.' });
  }
});

app.put('/api/admin/shows/:id', requireAdmin, (req, res) => {
  const showId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId) as
    | {
        id: number;
        movie_id: number;
        screen_id: number;
        show_date: string;
        show_time: string;
        end_time: string;
        silver_price: number;
        gold_price: number;
        platinum_price: number;
        status: string;
      }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Show not found.' });
    return;
  }

  const body = req.body ?? {};
  const nextMovieId = body.movie_id !== undefined ? Number(body.movie_id) : existing.movie_id;
  const nextScreenId = body.screen_id !== undefined ? Number(body.screen_id) : existing.screen_id;
  const nextDate = body.show_date !== undefined ? String(body.show_date).trim() : existing.show_date;
  const nextTime = body.show_time !== undefined ? String(body.show_time).trim() : existing.show_time;
  const nextEnd = body.end_time !== undefined ? String(body.end_time).trim() : existing.end_time;
  const nextSilver = body.silver_price !== undefined ? Number(body.silver_price) : existing.silver_price;
  const nextGold = body.gold_price !== undefined ? Number(body.gold_price) : existing.gold_price;
  const nextPlatinum =
    body.platinum_price !== undefined ? Number(body.platinum_price) : existing.platinum_price;
  const nextStatus =
    body.status !== undefined
      ? String(body.status).toUpperCase() === 'CANCELLED'
        ? 'CANCELLED'
        : 'ACTIVE'
      : existing.status;

  try {
    const { resolvedEndTime } = validateAndCheckShowOverlap({
      movieId: nextMovieId,
      screenId: nextScreenId,
      showDate: nextDate,
      showTime: nextTime,
      endTime: nextEnd || undefined,
      excludeShowId: showId,
      allowPast: nextStatus === 'CANCELLED',
    });

    db.prepare(
      `UPDATE shows
       SET movie_id = ?, screen_id = ?, show_date = ?, show_time = ?, end_time = ?,
           silver_price = ?, gold_price = ?, platinum_price = ?, status = ?
       WHERE id = ?`
    ).run(
      nextMovieId,
      nextScreenId,
      nextDate,
      nextTime,
      resolvedEndTime,
      nextSilver,
      nextGold,
      nextPlatinum,
      nextStatus,
      showId
    );
    res.json({ id: showId, message: 'Showtime updated successfully.' });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update show.' });
  }
});

app.patch('/api/admin/shows/:id/status', requireAdmin, (req, res) => {
  const showId = Number(req.params.id);
  const existing = db.prepare('SELECT id, status FROM shows WHERE id = ?').get(showId) as
    | { id: number; status: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Show not found.' });
    return;
  }
  const desired = String(req.body?.status || '').toUpperCase();
  if (desired !== 'ACTIVE' && desired !== 'CANCELLED') {
    res.status(400).json({ error: 'Status must be ACTIVE or CANCELLED.' });
    return;
  }
  db.prepare('UPDATE shows SET status = ? WHERE id = ?').run(desired, showId);
  res.json({
    id: showId,
    status: desired,
    message:
      desired === 'CANCELLED'
        ? 'Show cancelled. New bookings for this showtime are now blocked.'
        : 'Show reactivated for booking.',
  });
});

app.delete('/api/admin/shows/:id', requireAdmin, (req, res) => {
  const showId = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM shows WHERE id = ?').get(showId);
  if (!existing) {
    res.status(404).json({ error: 'Show not found.' });
    return;
  }
  const activeBookings = (
    db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE show_id = ? AND status = 'CONFIRMED'").get(showId) as {
      c: number;
    }
  ).c;
  if (activeBookings > 0) {
    res.status(409).json({
      error: `Cannot delete this show because ${activeBookings} confirmed booking(s) exist. Cancel the show instead so booking history is preserved.`,
    });
    return;
  }
  db.prepare('DELETE FROM shows WHERE id = ?').run(showId);
  res.json({ deleted: true, message: 'Showtime removed.' });
});

// ============================================================================
// JAVA SPRING BOOT SOURCE EXPLORER & DOWNLOADABLE MAVEN ZIP ENDPOINTS
// ============================================================================

const JAVA_ROOT = path.resolve(process.cwd(), 'cinebook-java');

function collectProjectFiles(
  dir: string,
  baseDir: string,
  list: Array<{ path: string; isBinary: boolean; size: number }> = []
) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectProjectFiles(full, baseDir, list);
    } else {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      const isBinary = /\.(jpg|jpeg|png|gif|ico)$/i.test(entry.name);
      const stat = fs.statSync(full);
      list.push({ path: rel, isBinary, size: stat.size });
    }
  }
  return list;
}

app.get('/api/java-project/files', (_req, res) => {
  const files = collectProjectFiles(JAVA_ROOT, JAVA_ROOT);
  res.json({ files });
});

app.get('/api/java-project/file', (req, res) => {
  const relPath = typeof req.query.path === 'string' ? req.query.path : '';
  const resolved = path.resolve(JAVA_ROOT, relPath);
  if (!resolved.startsWith(JAVA_ROOT) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  if (/\.(jpg|jpeg|png|gif|ico)$/i.test(resolved)) {
    res.json({ path: relPath, content: '[Binary image asset included in Maven static/images/ directory]' });
    return;
  }
  const content = fs.readFileSync(resolved, 'utf-8');
  res.json({ path: relPath, content });
});

app.get(
  '/api/java-project/download',
  asyncHandler(async (_req, res) => {
    const zip = new JSZip();
    const files = collectProjectFiles(JAVA_ROOT, JAVA_ROOT);
    for (const f of files) {
      const full = path.join(JAVA_ROOT, f.path);
      zip.file(`cinebook-java/${f.path}`, fs.readFileSync(full));
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="cinebook-spring-boot-mysql.zip"');
    res.send(buffer);
  })
);

// ============================================================================
// API 404 & GLOBAL JSON ERROR HANDLING
// ============================================================================

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    const isSyntaxErr =
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status?: number }).status === 400;
    if (isSyntaxErr) {
      res.status(400).json({ error: 'Invalid JSON payload in request body.' });
      return;
    }
    console.error(`[CineBook Server Error] ${req.method} ${req.originalUrl}:`, err);
    if (req.originalUrl.startsWith('/api')) {
      res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
      return;
    }
    res.status(500).send('Internal Server Error');
  }
);

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING + GRACEFUL SHUTDOWN
// ============================================================================

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const isHttpsProxy = String(process.env.APP_URL || '').startsWith('https://');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        hmr: !disableHmr,
        ws: {
          server: httpServer,
          ...(isHttpsProxy ? { clientPort: 443 } : {}),
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CineBook server running at http://localhost:${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`[CineBook] Received ${signal}, shutting down cleanly...`);
    httpServer.close(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (err) {
        console.warn('[CineBook] DB close warning:', err);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start CineBook server:', err);
  process.exit(1);
});
