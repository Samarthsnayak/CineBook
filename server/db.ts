import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import {
  DEFAULT_TIMEZONE,
  addMinutesToHHMM,
  getDateOffsetInTimezone,
  getShowWindowEpochMs,
  showWindowsOverlap,
} from './time.ts';

const DB_PATH = path.resolve(process.cwd(), 'cinebook.db');

export const db = new Database(DB_PATH);
db.pragma('busy_timeout = 5000');
try {
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('[DB] WAL mode unavailable, using default journal mode:', err);
}
db.pragma('foreign_keys = ON');

/**
 * Returns YYYY-MM-DD in Asia/Kolkata (IST) so all show dates and references
 * align cleanly with Indian theatre operating dates regardless of host OS timezone.
 */
export function formatLocalDate(offsetDays = 0, timezone = DEFAULT_TIMEZONE): string {
  return getDateOffsetInTimezone(offsetDays, timezone);
}

function ensureColumnExists(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      state TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      cast_members TEXT NOT NULL,
      director TEXT NOT NULL,
      genre TEXT NOT NULL,
      language TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      rating REAL,
      certificate TEXT NOT NULL DEFAULT 'UA',
      release_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOW_SHOWING' CHECK (status IN ('NOW_SHOWING', 'UPCOMING')),
      poster_url TEXT NOT NULL DEFAULT '',
      data_source TEXT NOT NULL DEFAULT 'CURATED',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS theatres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      amenities TEXT NOT NULL DEFAULT 'Dolby Atmos · 4K Laser · Gourmet Lounge',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'
    );

    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theatre_id INTEGER NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
      screen_number INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'Dolby Atmos',
      total_seats INTEGER NOT NULL DEFAULT 64
    );

    CREATE TABLE IF NOT EXISTS seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
      seat_number TEXT NOT NULL,
      row_label TEXT NOT NULL,
      seat_col INTEGER NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('SILVER', 'GOLD', 'PLATINUM')),
      UNIQUE(screen_id, seat_number)
    );

    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
      show_date TEXT NOT NULL,
      show_time TEXT NOT NULL,
      end_time TEXT NOT NULL DEFAULT '',
      silver_price REAL NOT NULL,
      gold_price REAL NOT NULL,
      platinum_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_reference TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      ticket_count INTEGER NOT NULL DEFAULT 1,
      seat_summary TEXT NOT NULL DEFAULT '',
      subtotal_amount REAL NOT NULL,
      convenience_fee REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
      booked_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS booking_seats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      seat_id INTEGER NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
      seat_number TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('SILVER', 'GOLD', 'PLATINUM')),
      price REAL NOT NULL,
      UNIQUE(show_id, seat_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'NET_BANKING')),
      payment_details TEXT,
      transaction_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'REFUNDED')),
      paid_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS movie_posters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL UNIQUE REFERENCES movies(id) ON DELETE CASCADE,
      storage_provider TEXT NOT NULL CHECK (storage_provider IN ('LOCAL', 'GCS')),
      storage_key TEXT NOT NULL UNIQUE,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      binary_data BLOB,
      public_url TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Non-destructive schema migrations for existing cinebook.db files
  ensureColumnExists('movies', 'tmdb_id', 'INTEGER');
  ensureColumnExists('movies', 'data_source', "TEXT NOT NULL DEFAULT 'CURATED'");
  ensureColumnExists('movies', 'poster_managed_by_admin', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumnExists('movies', 'poster_updated_at', 'TEXT');
  ensureColumnExists('movies', 'poster_storage_provider', 'TEXT');
  ensureColumnExists('theatres', 'location', "TEXT NOT NULL DEFAULT ''");
  ensureColumnExists('theatres', 'timezone', "TEXT NOT NULL DEFAULT 'Asia/Kolkata'");
  ensureColumnExists('screens', 'screen_number', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumnExists('shows', 'end_time', "TEXT NOT NULL DEFAULT ''");
  ensureColumnExists('shows', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
  ensureColumnExists('bookings', 'idempotency_key', 'TEXT');
  ensureColumnExists('bookings', 'ticket_count', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumnExists('bookings', 'seat_summary', "TEXT NOT NULL DEFAULT ''");
  ensureColumnExists('bookings', 'tax_amount', 'REAL NOT NULL DEFAULT 0');

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_shows_movie_date ON shows(movie_id, show_date, show_time);
    CREATE INDEX IF NOT EXISTS idx_shows_screen_date ON shows(screen_id, show_date, show_time);
    CREATE INDEX IF NOT EXISTS idx_theatres_city ON theatres(city);
    CREATE INDEX IF NOT EXISTS idx_screens_theatre ON screens(theatre_id);
  `);

  // Rebuild movies table only if legacy schema had rating NOT NULL
  const movieCols = db.prepare('PRAGMA table_info(movies)').all() as Array<{ name: string; notnull: number }>;
  const ratingCol = movieCols.find((c) => c.name === 'rating');
  if (ratingCol && ratingCol.notnull === 1) {
    db.pragma('foreign_keys = OFF');
    const migrateMovies = db.transaction(() => {
      db.exec(`
        CREATE TABLE movies_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tmdb_id INTEGER UNIQUE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          cast_members TEXT NOT NULL,
          director TEXT NOT NULL,
          genre TEXT NOT NULL,
          language TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          rating REAL,
          certificate TEXT NOT NULL DEFAULT 'UA',
          release_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'NOW_SHOWING' CHECK (status IN ('NOW_SHOWING', 'UPCOMING')),
          poster_url TEXT NOT NULL DEFAULT '',
          data_source TEXT NOT NULL DEFAULT 'CURATED',
          poster_managed_by_admin INTEGER NOT NULL DEFAULT 0,
          poster_updated_at TEXT,
          poster_storage_provider TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO movies_new (
          id, tmdb_id, title, description, cast_members, director, genre, language,
          duration_minutes, rating, certificate, release_date, status, poster_url, data_source,
          poster_managed_by_admin, poster_updated_at, poster_storage_provider, created_at
        )
        SELECT
          id, tmdb_id, title, description, cast_members, director, genre, language,
          duration_minutes, rating, certificate, release_date, status, poster_url, data_source,
          COALESCE(poster_managed_by_admin, 0), poster_updated_at, poster_storage_provider, created_at
        FROM movies;
        DROP TABLE movies;
        ALTER TABLE movies_new RENAME TO movies;
      `);
    });
    migrateMovies();
    db.pragma('foreign_keys = ON');
  }

  seedInitialData();
}

/**
 * Generates exact tiered seats (Silver / Gold / Platinum) for a screen with configurable capacity (24..160).
 */
export function generateSeatsForScreen(screenId: number, requestedCapacity = 64): number {
  const safeCapacity = Math.max(24, Math.min(160, Math.round(requestedCapacity)));
  const colsPerRow = safeCapacity <= 48 ? 8 : safeCapacity <= 96 ? 8 : 10;
  const rowCount = Math.ceil(safeCapacity / colsPerRow);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const insertSeat = db.prepare(
    'INSERT OR IGNORE INTO seats (screen_id, seat_number, row_label, seat_col, category) VALUES (?, ?, ?, ?, ?)'
  );

  let createdCount = 0;
  const tx = db.transaction(() => {
    for (let r = 0; r < rowCount && createdCount < safeCapacity; r++) {
      const rowLabel = alphabet[r] || `R${r + 1}`;
      const progress = rowCount <= 1 ? 0 : r / rowCount;
      const category: 'SILVER' | 'GOLD' | 'PLATINUM' =
        progress < 0.375 ? 'SILVER' : progress < 0.75 ? 'GOLD' : 'PLATINUM';
      for (let col = 1; col <= colsPerRow && createdCount < safeCapacity; col++) {
        insertSeat.run(screenId, `${rowLabel}${col}`, rowLabel, col, category);
        createdCount++;
      }
    }
    const actualCount = (
      db.prepare('SELECT COUNT(*) as c FROM seats WHERE screen_id = ?').get(screenId) as { c: number }
    ).c;
    db.prepare('UPDATE screens SET total_seats = ? WHERE id = ?').run(actualCount, screenId);
  });
  tx();

  const finalCount = (
    db.prepare('SELECT COUNT(*) as c FROM seats WHERE screen_id = ?').get(screenId) as { c: number }
  ).c;
  return finalCount;
}

interface SampleTheatreSeed {
  name: string;
  city: string;
  location: string;
  address: string;
  amenities: string;
  screens: Array<{ number: number; name: string; format: string; seats: number }>;
}

function seedInitialData(): void {
  // 1. Seed default Admin & Customer accounts if users table is empty
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)'
    );
    insertUser.run(
      'CineBook Administrator',
      'admin@cinebook.com',
      '9876543210',
      bcrypt.hashSync('Admin@123', 10),
      'ADMIN'
    );
    insertUser.run(
      'Aarav Sharma',
      'user@cinebook.com',
      '9820112233',
      bcrypt.hashSync('User@123', 10),
      'USER'
    );
  }

  // 2. Replace legacy placeholder demo titles only if present
  const legacyPlaceholder = db
    .prepare("SELECT id FROM movies WHERE title = 'Midnight Protocol'")
    .get();
  if (legacyPlaceholder) {
    db.exec('DELETE FROM booking_seats; DELETE FROM payments; DELETE FROM bookings; DELETE FROM shows; DELETE FROM movies;');
  }

  // 3. Seed Cities table (preserving any existing theatre cities)
  const defaultCities: Array<[string, string, string]> = [
    ['Bengaluru', 'Karnataka', 'Asia/Kolkata'],
    ['Mumbai', 'Maharashtra', 'Asia/Kolkata'],
    ['Chennai', 'Tamil Nadu', 'Asia/Kolkata'],
    ['Hyderabad', 'Telangana', 'Asia/Kolkata'],
    ['Kochi', 'Kerala', 'Asia/Kolkata'],
    ['New Delhi', 'Delhi NCR', 'Asia/Kolkata'],
  ];

  const insertCity = db.prepare(
    'INSERT OR IGNORE INTO cities (name, state, timezone) VALUES (?, ?, ?)'
  );
  for (const [name, state, tz] of defaultCities) {
    insertCity.run(name, state, tz);
  }
  const existingTheatreCities = db
    .prepare('SELECT DISTINCT city FROM theatres')
    .all() as Array<{ city: string }>;
  for (const row of existingTheatreCities) {
    if (row.city && row.city.trim()) {
      insertCity.run(row.city.trim(), '', 'Asia/Kolkata');
    }
  }

  // 4. Multi-City Sample Theatres (5–6 clearly identified sample theatres per city, editable by Admin)
  // Existing theatres in cinebook.db are preserved untouched so existing bookings never break.
  const sampleTheatresByCity: SampleTheatreSeed[] = [
    // Bengaluru (5 sample additions + any existing)
    {
      name: 'CineBook Multiplex – Indiranagar (Sample Venue)',
      city: 'Bengaluru',
      location: 'Indiranagar',
      address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru (Sample Listing)',
      amenities: '4K Laser · Dolby Atmos · Recliner Seating · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Laser 4K', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Dolby Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },
    {
      name: 'CineBook Grand – Whitefield (Sample Venue)',
      city: 'Bengaluru',
      location: 'Whitefield',
      address: 'ITPL Main Road, Brookefield, Whitefield, Bengaluru (Sample Listing)',
      amenities: 'IMAX 2D · Dolby Atmos · Parking · Food Court',
      screens: [
        { number: 1, name: 'Screen 1 · IMAX', format: 'IMAX 2D', seats: 80 },
        { number: 2, name: 'Screen 2 · Classic', format: 'Dolby Digital', seats: 64 },
      ],
    },
    {
      name: 'CineBook Plaza – Koramangala (Sample Venue)',
      city: 'Bengaluru',
      location: 'Koramangala',
      address: '80 Feet Road, 4th Block, Koramangala, Bengaluru (Sample Listing)',
      amenities: 'RGB Laser · Dolby Atmos · Gourmet Cafe · Wheelchair Access',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 64 },
        { number: 2, name: 'Screen 2 · Luxe', format: 'Luxe 4K', seats: 48 },
      ],
    },
    {
      name: 'CineBook Arena – Jayanagar (Sample Venue)',
      city: 'Bengaluru',
      location: 'Jayanagar',
      address: '11th Main Road, 4th Block, Jayanagar, Bengaluru (Sample Listing)',
      amenities: '4K Projection · Dolby 7.1 · Valet Parking',
      screens: [
        { number: 1, name: 'Screen 1 · Main', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Studio', format: 'Dolby 7.1', seats: 48 },
      ],
    },
    {
      name: 'CineBook Heights – Hebbal (Sample Venue)',
      city: 'Bengaluru',
      location: 'Hebbal',
      address: 'Outer Ring Road, Nagawara Junction, Hebbal, Bengaluru (Sample Listing)',
      amenities: 'Dolby Atmos · Recliner Lounges · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 72 },
        { number: 2, name: 'Screen 2 · Laser', format: '4K Laser', seats: 56 },
      ],
    },

    // Mumbai
    {
      name: 'CineBook Premiere – Bandra West (Sample Venue)',
      city: 'Mumbai',
      location: 'Bandra West',
      address: 'Linking Road, Bandra West, Mumbai (Sample Listing)',
      amenities: 'IMAX Laser · Dolby Atmos · Gourmet Lounge · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · IMAX', format: 'IMAX 2D', seats: 80 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 64 },
      ],
    },
    {
      name: 'CineBook Multiplex – Andheri West (Sample Venue)',
      city: 'Mumbai',
      location: 'Andheri West',
      address: 'New Link Road, Veera Desai Area, Andheri West, Mumbai (Sample Listing)',
      amenities: '4K Laser · Dolby Atmos · Recliners · Parking',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Gold', format: 'Dolby Atmos', seats: 48 },
      ],
    },
    {
      name: 'CineBook Galleria – Powai (Sample Venue)',
      city: 'Mumbai',
      location: 'Powai',
      address: 'Central Avenue, Hiranandani Gardens, Powai, Mumbai (Sample Listing)',
      amenities: 'Dolby Atmos · 4K Projection · Food Court',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 64 },
        { number: 2, name: 'Screen 2 · Classic', format: 'Dolby 7.1', seats: 56 },
      ],
    },
    {
      name: 'CineBook Harbour – Malad West (Sample Venue)',
      city: 'Mumbai',
      location: 'Malad West',
      address: 'Mindspace Link Road, Malad West, Mumbai (Sample Listing)',
      amenities: 'RGB Laser · Dolby Atmos · Wheelchair Access',
      screens: [
        { number: 1, name: 'Screen 1 · RGB', format: 'RGB Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },
    {
      name: 'CineBook Promenade – Thane West (Sample Venue)',
      city: 'Mumbai',
      location: 'Thane West',
      address: 'Eastern Express Highway, Majiwada, Thane West, Mumbai (Sample Listing)',
      amenities: '4K Laser · Recliners · Valet Parking · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 72 },
        { number: 2, name: 'Screen 2 · Luxe', format: 'Luxe 4K', seats: 48 },
      ],
    },

    // Chennai
    {
      name: 'CineBook Marina – Velachery (Sample Venue)',
      city: 'Chennai',
      location: 'Velachery',
      address: 'Velachery Main Road, Phoenix Corridor, Chennai (Sample Listing)',
      amenities: 'IMAX 2D · Dolby Atmos · Gourmet Counter · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · IMAX', format: 'IMAX 2D', seats: 80 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 64 },
      ],
    },
    {
      name: 'CineBook Avenue – Anna Nagar (Sample Venue)',
      city: 'Chennai',
      location: 'Anna Nagar',
      address: '2nd Avenue, Anna Nagar East, Chennai (Sample Listing)',
      amenities: '4K RGB Laser · Dolby Atmos · Parking',
      screens: [
        { number: 1, name: 'Screen 1 · RGB', format: '4K RGB Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Classic', format: 'Dolby 7.1', seats: 56 },
      ],
    },
    {
      name: 'CineBook TechPark – OMR Thoraipakkam (Sample Venue)',
      city: 'Chennai',
      location: 'OMR',
      address: 'Rajiv Gandhi Salai, OMR Thoraipakkam, Chennai (Sample Listing)',
      amenities: 'Dolby Atmos · Recliner Seats · Cafe Lounge',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 64 },
        { number: 2, name: 'Screen 2 · Gold', format: '4K Laser', seats: 48 },
      ],
    },
    {
      name: 'CineBook Central – Vadapalani (Sample Venue)',
      city: 'Chennai',
      location: 'Vadapalani',
      address: 'Arcot Road, Vadapalani, Chennai (Sample Listing)',
      amenities: '4K Laser · Dolby Atmos · Food Court',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },
    {
      name: 'CineBook Pavilion – Adyar (Sample Venue)',
      city: 'Chennai',
      location: 'Adyar',
      address: 'Sardar Patel Road, Adyar, Chennai (Sample Listing)',
      amenities: 'Dolby Atmos · Wheelchair Access · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 56 },
        { number: 2, name: 'Screen 2 · Studio', format: '4K Projection', seats: 48 },
      ],
    },

    // Hyderabad
    {
      name: 'CineBook CyberPlex – HITEC City (Sample Venue)',
      city: 'Hyderabad',
      location: 'HITEC City',
      address: 'Madhapur Main Road, HITEC City, Hyderabad (Sample Listing)',
      amenities: 'IMAX Laser · Dolby Atmos · Lounge · Parking',
      screens: [
        { number: 1, name: 'Screen 1 · IMAX', format: 'IMAX 2D', seats: 80 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 64 },
      ],
    },
    {
      name: 'CineBook Jubilee – Banjara Hills (Sample Venue)',
      city: 'Hyderabad',
      location: 'Banjara Hills',
      address: 'Road No. 1, Banjara Hills, Hyderabad (Sample Listing)',
      amenities: '4K Laser · Recliners · Gourmet Lounge · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Luxe', format: 'Luxe 4K', seats: 56 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 64 },
      ],
    },
    {
      name: 'CineBook Forum – Kukatpally (Sample Venue)',
      city: 'Hyderabad',
      location: 'Kukatpally',
      address: 'KPHB Phase 6, Kukatpally, Hyderabad (Sample Listing)',
      amenities: 'RGB Laser · Dolby Atmos · Food Court',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Classic', format: 'Dolby 7.1', seats: 56 },
      ],
    },
    {
      name: 'CineBook Metro – Begumpet (Sample Venue)',
      city: 'Hyderabad',
      location: 'Begumpet',
      address: 'SP Road, Begumpet, Hyderabad (Sample Listing)',
      amenities: 'Dolby Atmos · 4K Projection · Metro Access',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 64 },
        { number: 2, name: 'Screen 2 · Studio', format: '4K Laser', seats: 48 },
      ],
    },
    {
      name: 'CineBook Arcade – Uppal (Sample Venue)',
      city: 'Hyderabad',
      location: 'Uppal',
      address: 'Inner Ring Road, Uppal, Hyderabad (Sample Listing)',
      amenities: '4K Laser · Dolby 7.1 · Parking · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Main', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },

    // Kochi
    {
      name: 'CineBook Waterfront – MG Road (Sample Venue)',
      city: 'Kochi',
      location: 'MG Road',
      address: 'Mahatma Gandhi Road, Ernakulam, Kochi (Sample Listing)',
      amenities: '4K Laser · Dolby Atmos · M-Ticket · Cafe',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },
    {
      name: 'CineBook Hub – Vyttila (Sample Venue)',
      city: 'Kochi',
      location: 'Vyttila',
      address: 'SA Road, Vyttila Junction, Kochi (Sample Listing)',
      amenities: 'Dolby Atmos · Recliner Seats · Parking',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 64 },
        { number: 2, name: 'Screen 2 · Gold', format: '4K Laser', seats: 48 },
      ],
    },
    {
      name: 'CineBook Infopark – Kakkanad (Sample Venue)',
      city: 'Kochi',
      location: 'Kakkanad',
      address: 'Seaport-Airport Road, Kakkanad, Kochi (Sample Listing)',
      amenities: 'RGB Laser · Dolby Atmos · Food Court',
      screens: [
        { number: 1, name: 'Screen 1 · RGB', format: 'RGB Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Classic', format: 'Dolby 7.1', seats: 56 },
      ],
    },
    {
      name: 'CineBook Bay – Marine Drive (Sample Venue)',
      city: 'Kochi',
      location: 'Marine Drive',
      address: 'Shanmugham Road, Marine Drive, Kochi (Sample Listing)',
      amenities: '4K Laser · Dolby Atmos · Wheelchair Access',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Luxe', format: 'Luxe 4K', seats: 48 },
      ],
    },
    {
      name: 'CineBook Courtyard – Aluva (Sample Venue)',
      city: 'Kochi',
      location: 'Aluva',
      address: 'Bypass Road, Aluva, Kochi (Sample Listing)',
      amenities: 'Dolby Atmos · Parking · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 56 },
        { number: 2, name: 'Screen 2 · Studio', format: '4K Projection', seats: 48 },
      ],
    },

    // New Delhi
    {
      name: 'CineBook Capital – Connaught Place (Sample Venue)',
      city: 'New Delhi',
      location: 'Connaught Place',
      address: 'Outer Circle, Connaught Place, New Delhi (Sample Listing)',
      amenities: 'IMAX 2D · Dolby Atmos · Heritage Lounge · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · IMAX', format: 'IMAX 2D', seats: 80 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 64 },
      ],
    },
    {
      name: 'CineBook District – Saket (Sample Venue)',
      city: 'New Delhi',
      location: 'Saket',
      address: 'District Centre, Press Enclave Road, Saket, New Delhi (Sample Listing)',
      amenities: '4K Laser · Dolby Atmos · Recliners · Parking',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Gold', format: 'Luxe 4K', seats: 48 },
      ],
    },
    {
      name: 'CineBook Promenade – Vasant Kunj (Sample Venue)',
      city: 'New Delhi',
      location: 'Vasant Kunj',
      address: 'Nelson Mandela Marg, Vasant Kunj, New Delhi (Sample Listing)',
      amenities: 'RGB Laser · Dolby Atmos · Gourmet Lounge',
      screens: [
        { number: 1, name: 'Screen 1 · RGB', format: 'RGB Laser', seats: 64 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },
    {
      name: 'CineBook Westgate – Rajouri Garden (Sample Venue)',
      city: 'New Delhi',
      location: 'Rajouri Garden',
      address: 'Ring Road, Rajouri Garden, New Delhi (Sample Listing)',
      amenities: 'Dolby Atmos · Food Court · Metro Access',
      screens: [
        { number: 1, name: 'Screen 1 · Atmos', format: 'Dolby Atmos', seats: 64 },
        { number: 2, name: 'Screen 2 · Classic', format: 'Dolby 7.1', seats: 56 },
      ],
    },
    {
      name: 'CineBook Vegas – Dwarka Sector 14 (Sample Venue)',
      city: 'New Delhi',
      location: 'Dwarka',
      address: 'Sector 14, Dwarka, New Delhi (Sample Listing)',
      amenities: '4K Laser · Recliners · Parking · M-Ticket',
      screens: [
        { number: 1, name: 'Screen 1 · Laser', format: '4K Laser', seats: 72 },
        { number: 2, name: 'Screen 2 · Atmos', format: 'Dolby Atmos', seats: 56 },
      ],
    },
  ];

  // Ensure every major city has at least 5 theatres (5–6 total per city)
  const insertTheatreStmt = db.prepare(
    'INSERT INTO theatres (name, city, location, address, amenities, timezone) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertScreenStmt = db.prepare(
    'INSERT INTO screens (theatre_id, screen_number, name, format, total_seats) VALUES (?, ?, ?, ?, ?)'
  );

  for (const spec of sampleTheatresByCity) {
    const cityCount = (
      db.prepare('SELECT COUNT(*) as c FROM theatres WHERE LOWER(city) = LOWER(?)').get(spec.city) as { c: number }
    ).c;
    if (cityCount >= 6) continue;
    const exists = db
      .prepare('SELECT id FROM theatres WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)')
      .get(spec.name, spec.city);
    if (exists) continue;

    const tId = Number(
      insertTheatreStmt.run(
        spec.name,
        spec.city,
        spec.location,
        spec.address,
        spec.amenities,
        DEFAULT_TIMEZONE
      ).lastInsertRowid
    );
    for (const sc of spec.screens) {
      const sId = Number(
        insertScreenStmt.run(tId, sc.number, sc.name, sc.format, sc.seats).lastInsertRowid
      );
      generateSeatsForScreen(sId, sc.seats);
    }
  }

  // Backfill location & timezone on any legacy theatres
  db.exec(`
    UPDATE theatres
    SET location = CASE WHEN TRIM(COALESCE(location, '')) = '' THEN city ELSE location END,
        timezone = CASE WHEN TRIM(COALESCE(timezone, '')) = '' THEN 'Asia/Kolkata' ELSE timezone END;
  `);

  // Ensure every screen has seats generated and a sensible screen_number
  const allScreens = db
    .prepare('SELECT id, theatre_id, total_seats FROM screens ORDER BY theatre_id ASC, id ASC')
    .all() as Array<{ id: number; theatre_id: number; total_seats: number }>;
  const perTheatreIdx = new Map<number, number>();
  for (const sc of allScreens) {
    const num = (perTheatreIdx.get(sc.theatre_id) || 0) + 1;
    perTheatreIdx.set(sc.theatre_id, num);
    db.prepare('UPDATE screens SET screen_number = ? WHERE id = ?').run(num, sc.id);
    const seatCnt = (
      db.prepare('SELECT COUNT(*) as c FROM seats WHERE screen_id = ?').get(sc.id) as { c: number }
    ).c;
    if (seatCnt === 0) {
      generateSeatsForScreen(sc.id, sc.total_seats || 64);
    }
  }

  interface SeedMovieSpec {
    tmdbId: number;
    title: string;
    description: string;
    cast: string;
    director: string;
    genre: string;
    language: string;
    duration: number;
    rating: number | null;
    certificate: string;
    releaseDate: string;
    status: 'NOW_SHOWING' | 'UPCOMING';
    posterUrl: string;
  }

  const realIndianMovies: SeedMovieSpec[] = [
    {
      tmdbId: 1213243,
      title: 'Toxic: A Fairy Tale for Grown-Ups',
      description:
        'Set against a brooding coastal underworld, a ruthless syndicate figure navigates betrayal, shifting power alliances, and a perilous legacy.',
      cast: 'Yash, Kiara Advani, Nayanthara, Huma Qureshi, Rukmini Vasanth',
      director: 'Geetu Mohandas',
      genre: 'Action / Thriller',
      language: 'Kannada',
      duration: 158,
      rating: null,
      certificate: 'A',
      releaseDate: '2026-08-26',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/toxic-2026.jpg',
    },
    {
      tmdbId: 1083637,
      title: 'Kantara: Chapter 1',
      description:
        'Set in the Kadamba dynasty era of coastal Karnataka, this mythological period prequel traces the sacred origins of the Bhoota Kola guardian tradition.',
      cast: 'Rishab Shetty, Jayaram, Rukmini Vasanth, Gulshan Devaiah',
      director: 'Rishab Shetty',
      genre: 'Action / Drama',
      language: 'Kannada',
      duration: 160,
      rating: 8.6,
      certificate: 'UA',
      releaseDate: '2025-10-02',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/kantara-chapter-1.jpg',
    },
    {
      tmdbId: 656908,
      title: 'Ramayana: Part 1',
      description:
        'A grand theatrical retelling of the Indian epic chronicling the exile of Prince Rama, Sita, and Lakshmana, and the gathering confrontation with Lanka.',
      cast: 'Ranbir Kapoor, Sai Pallavi, Yash, Sunny Deol, Ravi Dubey',
      director: 'Nitesh Tiwari',
      genre: 'Adventure / Drama',
      language: 'Hindi',
      duration: 180,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-11-05',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/ramayana-part-1.jpg',
    },
    {
      tmdbId: 1582770,
      title: 'Dhurandhar: The Revenge',
      description:
        'Following a high-stakes covert intelligence crisis, an elite Indian operative leads a relentless cross-border mission against an entrenched terror network.',
      cast: 'Ranveer Singh, Sanjay Dutt, R. Madhavan, Akshaye Khanna',
      director: 'Aditya Dhar',
      genre: 'Action / Thriller',
      language: 'Hindi',
      duration: 165,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-03-19',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/dhurandhar-the-revenge.jpg',
    },
    {
      tmdbId: 1234139,
      title: 'Jailer 2',
      description:
        'Retired prison officer Muthuvel Pandian returns to confront a ruthless criminal cartel when a fresh threat strikes close to his family.',
      cast: 'Rajinikanth, S. J. Suryah, Mithun Chakraborty, Ramya Krishnan, Yogi Babu',
      director: 'Nelson Dilipkumar',
      genre: 'Action / Comedy',
      language: 'Tamil',
      duration: 165,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-10-15',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/jailer-2.jpg',
    },
    {
      tmdbId: 1057265,
      title: 'Peddi',
      description:
        'In a fiercely spirited rural Andhra town, an underdog athlete rises through grit and local rivalry to unite his village on the biggest sporting stage.',
      cast: 'Ram Charan, Shiva Rajkumar, Janhvi Kapoor, Jagapathi Babu',
      director: 'Buchi Babu Sana',
      genre: 'Action / Drama',
      language: 'Telugu',
      duration: 168,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-06-04',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/peddi.jpg',
    },
    {
      tmdbId: 1508168,
      title: 'Bethlehem Kudumba Unit',
      description:
        'A warm, comedic Kerala family drama following eccentric relatives whose chaotic reunion sparks unexpected romance and heartfelt reconciliation.',
      cast: 'Nivin Pauly, Mamitha Baiju, Sangeeth Prathap, Vinay Forrt',
      director: 'Girish A.D.',
      genre: 'Comedy / Romance',
      language: 'Malayalam',
      duration: 144,
      rating: null,
      certificate: 'U',
      releaseDate: '2026-08-21',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/bethlehem-kudumba-unit.jpg',
    },
    {
      tmdbId: 847742,
      title: 'Drishyam 3',
      description:
        'Years after covering up a fateful night, Georgekutty faces a relentless new investigation that tests his wits and his family’s unbreakable silence.',
      cast: 'Mohanlal, Meena, Ansiba Hassan, Esther Anil',
      director: 'Jeethu Joseph',
      genre: 'Crime / Thriller',
      language: 'Malayalam',
      duration: 158,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-10-02',
      status: 'NOW_SHOWING',
      posterUrl: '/posters/drishyam-3.jpg',
    },
    {
      tmdbId: 1145110,
      title: 'King',
      description:
        'A hardened underworld mentor trains a young protege through a perilous web of vendettas across international capitals.',
      cast: 'Shah Rukh Khan, Deepika Padukone, Suhana Khan, Abhishek Bachchan',
      director: 'Siddharth Anand',
      genre: 'Action / Thriller',
      language: 'Hindi',
      duration: 150,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-12-24',
      status: 'UPCOMING',
      posterUrl: '/posters/king.jpg',
    },
    {
      tmdbId: 1257973,
      title: 'Fauzi',
      description:
        'Set against a turbulent historical backdrop in pre-independence India, a defiant soldier challenges imperial rule in an epic tale of courage and sacrifice.',
      cast: 'Prabhas, Imanvi, Mithun Chakraborty, Jaya Prada',
      director: 'Hanu Raghavapudi',
      genre: 'Action / Drama',
      language: 'Telugu',
      duration: 156,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-12-03',
      status: 'UPCOMING',
      posterUrl: '/posters/fauzi.jpg',
    },
    {
      tmdbId: 1367220,
      title: 'Karuppu',
      description:
        'A lawyer drawn into a fiercely contested case discovers an ancient spiritual force guiding him to confront entrenched corruption and injustice.',
      cast: 'Suriya, Trisha Krishnan, Indrans, Swasika',
      director: 'RJ Balaji',
      genre: 'Action / Drama',
      language: 'Tamil',
      duration: 152,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-12-18',
      status: 'UPCOMING',
      posterUrl: '/posters/karuppu.jpg',
    },
    {
      tmdbId: 1122030,
      title: 'Alpha',
      description:
        'Two elite female intelligence agents in India’s covert spy universe confront a ruthless international adversary in a high-octane espionage thriller.',
      cast: 'Alia Bhatt, Sharvari, Bobby Deol, Anil Kapoor',
      director: 'Shiv Rawail',
      genre: 'Action / Thriller',
      language: 'Hindi',
      duration: 148,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-12-25',
      status: 'UPCOMING',
      posterUrl: '/posters/alpha.jpg',
    },
    {
      tmdbId: 1103473,
      title: 'KD: The Devil',
      description:
        'Set in 1970s Bengaluru, a fearless gangster rises from the underworld in a stylized period action drama fueled by loyalty and vengeance.',
      cast: 'Dhruva Sarja, Sanjay Dutt, Shilpa Shetty, Reeshma Nanaiah, V. Ravichandran',
      director: 'Prem',
      genre: 'Action / Thriller',
      language: 'Kannada',
      duration: 162,
      rating: null,
      certificate: 'UA',
      releaseDate: '2026-12-11',
      status: 'UPCOMING',
      posterUrl: '/posters/kd-the-devil.jpg',
    },
    {
      tmdbId: 920708,
      title: 'Varanasi',
      description:
        'An ambitious globe-trotting action-adventure drawing on ancient Indian lore as an explorer embarks on an extraordinary expedition.',
      cast: 'Mahesh Babu, Priyanka Chopra, Prithviraj Sukumaran',
      director: 'S. S. Rajamouli',
      genre: 'Adventure / Action',
      language: 'Telugu',
      duration: 180,
      rating: null,
      certificate: 'UA',
      releaseDate: '2027-04-07',
      status: 'UPCOMING',
      posterUrl: '/posters/varanasi.jpg',
    },
  ];

  const insertMovie = db.prepare(`
    INSERT INTO movies (
      tmdb_id, title, description, cast_members, director, genre, language,
      duration_minutes, rating, certificate, release_date, status, poster_url, data_source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CURATED')
  `);

  const syncMoviesTx = db.transaction(() => {
    for (const m of realIndianMovies) {
      const existing = db
        .prepare('SELECT id, poster_url, poster_managed_by_admin FROM movies WHERE title = ? OR tmdb_id = ?')
        .get(m.title, m.tmdbId) as
        | { id: number; poster_url: string; poster_managed_by_admin: number }
        | undefined;
      if (!existing) {
        insertMovie.run(
          m.tmdbId,
          m.title,
          m.description,
          m.cast,
          m.director,
          m.genre,
          m.language,
          m.duration,
          m.rating,
          m.certificate,
          m.releaseDate,
          m.status,
          m.posterUrl
        );
      } else {
        // Only fill poster if blank and not explicitly managed by admin with an uploaded poster
        const hasUploaded = db
          .prepare('SELECT id FROM movie_posters WHERE movie_id = ?')
          .get(existing.id);
        if (!hasUploaded && (!existing.poster_url || existing.poster_url.trim() === '') && existing.poster_managed_by_admin === 0) {
          db.prepare('UPDATE movies SET poster_url = ?, tmdb_id = COALESCE(tmdb_id, ?) WHERE id = ?').run(
            m.posterUrl,
            m.tmdbId,
            existing.id
          );
        } else {
          db.prepare('UPDATE movies SET tmdb_id = COALESCE(tmdb_id, ?) WHERE id = ?').run(
            m.tmdbId,
            existing.id
          );
        }
      }
    }
  });
  syncMoviesTx();

  // 5. Backfill end_time & status on any pre-existing shows
  const showsMissingEnd = db
    .prepare(
      `SELECT sh.id, sh.show_time, m.duration_minutes
       FROM shows sh
       JOIN movies m ON m.id = sh.movie_id
       WHERE sh.end_time IS NULL OR TRIM(sh.end_time) = ''`
    )
    .all() as Array<{ id: number; show_time: string; duration_minutes: number }>;
  if (showsMissingEnd.length > 0) {
    const updEnd = db.prepare("UPDATE shows SET end_time = ?, status = COALESCE(NULLIF(status, ''), 'ACTIVE') WHERE id = ?");
    const tx = db.transaction(() => {
      for (const s of showsMissingEnd) {
        updEnd.run(addMinutesToHHMM(s.show_time, (s.duration_minutes || 150) + 15), s.id);
      }
    });
    tx();
  }

  // 6. Rolling 7-Day Non-Overlapping Schedule Seeder
  // Guarantees every theatre across every city has 3–4+ shows/day for today through Day+6,
  // covering all NOW_SHOWING films across every city without ever creating overlapping shows on a screen.
  ensureRollingWeeklySchedule();
}

export function ensureRollingWeeklySchedule(): void {
  const nowShowingMovies = db
    .prepare("SELECT id, duration_minutes FROM movies WHERE status = 'NOW_SHOWING' ORDER BY id ASC")
    .all() as Array<{ id: number; duration_minutes: number }>;
  if (nowShowingMovies.length === 0) return;

  const theatres = db
    .prepare('SELECT id, city, timezone FROM theatres ORDER BY city ASC, id ASC')
    .all() as Array<{ id: number; city: string; timezone: string }>;
  if (theatres.length === 0) return;

  const screensByTheatre = new Map<number, Array<{ id: number; screen_number: number }>>();
  const allScreens = db
    .prepare('SELECT id, theatre_id, screen_number FROM screens ORDER BY theatre_id ASC, screen_number ASC, id ASC')
    .all() as Array<{ id: number; theatre_id: number; screen_number: number }>;
  for (const sc of allScreens) {
    const list = screensByTheatre.get(sc.theatre_id) || [];
    list.push({ id: sc.id, screen_number: sc.screen_number });
    screensByTheatre.set(sc.theatre_id, list);
  }

  // Carefully spaced non-overlapping slots (each >= 3h 45m apart so even 180-min films + 15m buffer never overlap!)
  const slotTemplates: Array<string[]> = [
    ['09:30', '13:30', '17:30', '21:30'],
    ['10:45', '14:45', '18:45', '22:40'],
  ];

  const existingShowsStmt = db.prepare(
    `SELECT sh.show_time, sh.end_time, m.duration_minutes
     FROM shows sh
     JOIN movies m ON m.id = sh.movie_id
     WHERE sh.screen_id = ? AND sh.show_date = ? AND sh.status = 'ACTIVE'`
  );
  const insertShow = db.prepare(`
    INSERT INTO shows (movie_id, screen_id, show_date, show_time, end_time, silver_price, gold_price, platinum_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `);

  const cityTheatreCounter = new Map<string, number>();

  const scheduleTx = db.transaction(() => {
    for (const theatre of theatres) {
      const tScreens = screensByTheatre.get(theatre.id) || [];
      if (tScreens.length === 0) continue;

      const tIdxInCity = cityTheatreCounter.get(theatre.city) || 0;
      cityTheatreCounter.set(theatre.city, tIdxInCity + 1);
      const tz = theatre.timezone || DEFAULT_TIMEZONE;

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const showDate = getDateOffsetInTimezone(dayOffset, tz);

        for (let sIdx = 0; sIdx < tScreens.length; sIdx++) {
          const screen = tScreens[sIdx];
          const existing = existingShowsStmt.all(screen.id, showDate) as Array<{
            show_time: string;
            end_time: string;
            duration_minutes: number;
          }>;

          // If this screen already has >= 3 shows on this date, leave its schedule intact
          if (existing.length >= 3) continue;

          const existingWindows = existing.map((ex) =>
            getShowWindowEpochMs(showDate, ex.show_time, ex.end_time, (ex.duration_minutes || 150) + 15, tz)
          );

          const times = slotTemplates[sIdx % slotTemplates.length];
          for (let ti = 0; ti < times.length; ti++) {
            const startTime = times[ti];
            const movieIdx = (tIdxInCity * 2 + sIdx * 3 + ti + dayOffset) % nowShowingMovies.length;
            const movie = nowShowingMovies[movieIdx];
            const runtimeWithBuffer = Math.min(200, (movie.duration_minutes || 150) + 15);
            const endTime = addMinutesToHHMM(startTime, runtimeWithBuffer);
            const candidateWin = getShowWindowEpochMs(showDate, startTime, endTime, runtimeWithBuffer, tz);

            // Prevent any overlap with existing shows on this screen
            const overlaps = existingWindows.some((w) =>
              showWindowsOverlap(candidateWin.startEpochMs, candidateWin.endEpochMs, w.startEpochMs, w.endEpochMs, 10)
            );
            if (overlaps) continue;

            const isPrime = ti >= 2;
            const isWeekendBump = dayOffset >= 5 ? 20 : 0;
            const silver = (isPrime ? 240 : 180) + isWeekendBump;
            const gold = (isPrime ? 360 : 280) + isWeekendBump;
            const platinum = (isPrime ? 540 : 420) + isWeekendBump;

            insertShow.run(
              movie.id,
              screen.id,
              showDate,
              startTime,
              endTime,
              silver,
              gold,
              platinum
            );
            existingWindows.push(candidateWin);
          }
        }
      }
    }
  });
  scheduleTx();
}
