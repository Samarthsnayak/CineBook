export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'USER' | 'ADMIN';
  created_at?: string;
  booking_count?: number;
}

export interface ServerClock {
  epochMs: number;
  isoUtc: string;
  timezone: string;
  date: string; // YYYY-MM-DD
  time24: string; // HH:MM:SS
  timeHHMM: string; // HH:MM
  time12: string; // h:mm:ss AM/PM
  timeShort12: string; // h:mm AM/PM
  dayName: string;
  formattedDate: string;
}

export interface CityRecord {
  id: number;
  name: string;
  state: string;
  timezone: string;
  theatre_count?: number;
  created_at?: string;
}

export interface CalendarDayInfo {
  date: string;
  isToday: boolean;
  hasShows: boolean;
  hasBookableShows: boolean;
  totalShowCount: number;
  bookableShowCount: number;
  theatreCount: number;
}

export type ShowBookingStatus =
  | 'OPEN'
  | 'STARTED'
  | 'COMPLETED'
  | 'PAST_DATE'
  | 'CANCELLED'
  | 'SOLD_OUT';

export interface Movie {
  id: number;
  tmdb_id?: number | null;
  title: string;
  description: string;
  cast_members: string;
  director: string;
  genre: string;
  language: string;
  duration_minutes: number;
  rating: number | null;
  certificate: string;
  release_date: string;
  status: 'NOW_SHOWING' | 'UPCOMING';
  poster_url: string;
  data_source?: string;
  active_show_count?: number;
}

export interface Screen {
  id: number;
  theatre_id: number;
  screen_number?: number;
  name: string;
  format: string;
  total_seats: number;
  theatre_name?: string;
  theatre_city?: string;
}

export interface Theatre {
  id: number;
  name: string;
  city: string;
  location?: string;
  address: string;
  amenities: string;
  timezone?: string;
  screens?: Screen[];
}

export interface ShowItem {
  id: number;
  movie_id: number;
  screen_id: number;
  show_date: string;
  show_time: string;
  end_time?: string;
  status?: 'ACTIVE' | 'CANCELLED';
  silver_price: number;
  gold_price: number;
  platinum_price: number;
  movie_title: string;
  movie_poster: string;
  movie_language: string;
  movie_certificate: string;
  movie_genre?: string;
  movie_duration: number;
  screen_number?: number;
  screen_name: string;
  screen_format: string;
  total_seats?: number;
  theatre_id: number;
  theatre_name: string;
  theatre_city: string;
  theatre_location?: string;
  theatre_address: string;
  theatre_amenities?: string;
  timezone?: string;
  booked_count?: number;
  available_seats?: number;
  booking_status?: ShowBookingStatus;
  is_bookable?: boolean;
  booking_block_reason?: string | null;
  starts_in_minutes?: number;
}

export interface SeatSlot {
  id: number;
  seatNumber: string;
  rowLabel: string;
  seatCol: number;
  category: 'SILVER' | 'GOLD' | 'PLATINUM';
  price: number;
  booked: boolean;
}

export interface BookingRecord {
  id: number;
  booking_reference: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  show_id: number;
  ticket_count: number;
  seat_summary?: string;
  subtotal_amount: number;
  convenience_fee: number;
  tax_amount: number;
  total_amount: number;
  status: 'CONFIRMED' | 'CANCELLED';
  booked_at: string;
  cancelled_at?: string | null;
  show_date: string;
  show_time: string;
  end_time?: string;
  movie_id?: number;
  movie_title: string;
  movie_poster?: string;
  movie_language?: string;
  movie_genre?: string;
  movie_director?: string;
  movie_certificate?: string;
  movie_duration?: number;
  screen_name: string;
  screen_format?: string;
  theatre_name: string;
  theatre_city: string;
  theatre_address?: string;
  payment_method?: 'UPI' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'NET_BANKING';
  payment_details?: string;
  transaction_id?: string;
  payment_status?: 'SUCCESS' | 'FAILED' | 'REFUNDED';
  paid_at?: string;
  seats?: Array<{ seat_id: number; seat_number: string; category: string; price: number }>;
  seat_numbers?: string;
  qrCode?: string;
}

export interface AdminStats {
  totalRevenue: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalMovies: number;
  totalCities?: number;
  totalTheatres: number;
  totalShows: number;
  totalUsers: number;
  seatsSold: number;
}

export type AdminTab = 'movies' | 'posters' | 'cities' | 'theatres' | 'shows' | 'bookings' | 'users';

export interface PosterStorageInfo {
  provider: 'LOCAL' | 'GCS';
  label: string;
  durableAcrossRedeploys: boolean;
}

export interface AdminPosterMovie {
  id: number;
  title: string;
  language: string;
  genre: string;
  director: string;
  certificate: string;
  release_date: string;
  status: 'NOW_SHOWING' | 'UPCOMING';
  poster_url: string;
  poster_managed_by_admin?: number;
  poster_updated_at?: string | null;
  poster_storage_provider?: 'LOCAL' | 'GCS' | null;
  poster_original_filename?: string | null;
  poster_mime_type?: string | null;
  poster_byte_size?: number | null;
  poster_storage_key?: string | null;
  poster_uploaded_at?: string | null;
}

export type AppView =
  | { name: 'home' }
  | { name: 'movies'; initialQuery?: string; initialStatus?: string; initialLanguage?: string }
  | { name: 'movie-details'; movieId: number }
  | { name: 'theatres' }
  | { name: 'seats'; showId: number }
  | { name: 'summary'; show: ShowItem; seats: SeatSlot[] }
  | { name: 'payment'; show: ShowItem; seats: SeatSlot[] }
  | { name: 'ticket'; bookingRef: string; booking?: BookingRecord; justBooked?: boolean }
  | { name: 'my-bookings' }
  | { name: 'offers' }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'login'; redirectAfter?: AppView; adminMode?: boolean }
  | { name: 'register'; redirectAfter?: AppView }
  | { name: 'admin'; initialTab?: AdminTab }
  | { name: 'java-source' };
