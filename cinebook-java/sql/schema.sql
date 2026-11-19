-- ============================================================================
-- CineBook – Online Movie Ticket Booking System
-- MySQL 8.0 Relational Database Schema (9 Core Normalized Tables)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS cinebook_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cinebook_db;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- 2. MOVIES TABLE
CREATE TABLE IF NOT EXISTS movies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tmdb_id BIGINT NULL UNIQUE,
    data_source VARCHAR(32) NOT NULL DEFAULT 'VERIFIED_INDIAN_CATALOG',
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    cast_members VARCHAR(500) NOT NULL,
    director VARCHAR(140) NOT NULL,
    genre VARCHAR(120) NOT NULL,
    language VARCHAR(80) NOT NULL,
    duration_minutes INT NOT NULL,
    rating DECIMAL(3,1) NULL,
    certificate VARCHAR(12) NOT NULL DEFAULT 'UA',
    release_date DATE NOT NULL,
    status ENUM('NOW_SHOWING', 'UPCOMING') NOT NULL DEFAULT 'NOW_SHOWING',
    poster_url VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_movies_status (status),
    INDEX idx_movies_language (language),
    INDEX idx_movies_title (title)
) ENGINE=InnoDB;

-- 3. THEATRES TABLE
CREATE TABLE IF NOT EXISTS theatres (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address VARCHAR(300) NOT NULL,
    amenities VARCHAR(255) DEFAULT 'Dolby Atmos, 4K Laser, Food Court',
    INDEX idx_theatres_city (city)
) ENGINE=InnoDB;

-- 4. SCREENS TABLE
CREATE TABLE IF NOT EXISTS screens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    theatre_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    format VARCHAR(40) NOT NULL DEFAULT '2D / Dolby Atmos',
    total_seats INT NOT NULL DEFAULT 64,
    CONSTRAINT fk_screens_theatre FOREIGN KEY (theatre_id)
        REFERENCES theatres(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. SEATS TABLE
CREATE TABLE IF NOT EXISTS seats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    screen_id BIGINT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    row_label VARCHAR(4) NOT NULL,
    seat_col INT NOT NULL,
    category ENUM('SILVER', 'GOLD', 'PLATINUM') NOT NULL,
    CONSTRAINT fk_seats_screen FOREIGN KEY (screen_id)
        REFERENCES screens(id) ON DELETE CASCADE,
    UNIQUE KEY uk_screen_seat (screen_id, seat_number)
) ENGINE=InnoDB;

-- 6. SHOWS TABLE
CREATE TABLE IF NOT EXISTS shows (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    movie_id BIGINT NOT NULL,
    screen_id BIGINT NOT NULL,
    show_date DATE NOT NULL,
    show_time TIME NOT NULL,
    silver_price DECIMAL(10,2) NOT NULL,
    gold_price DECIMAL(10,2) NOT NULL,
    platinum_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_shows_movie FOREIGN KEY (movie_id)
        REFERENCES movies(id) ON DELETE CASCADE,
    CONSTRAINT fk_shows_screen FOREIGN KEY (screen_id)
        REFERENCES screens(id) ON DELETE CASCADE,
    INDEX idx_shows_movie_date (movie_id, show_date)
) ENGINE=InnoDB;

-- 7. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(32) NOT NULL UNIQUE,
    idempotency_key VARCHAR(80) NULL UNIQUE,
    user_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    ticket_count INT NOT NULL DEFAULT 1,
    seat_summary VARCHAR(255) NOT NULL DEFAULT '',
    subtotal_amount DECIMAL(10,2) NOT NULL,
    convenience_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
    booked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_show FOREIGN KEY (show_id)
        REFERENCES shows(id) ON DELETE CASCADE,
    INDEX idx_bookings_user (user_id),
    INDEX idx_bookings_ref (booking_reference)
) ENGINE=InnoDB;

-- 8. BOOKING_SEATS TABLE
-- UNIQUE(show_id, seat_id) enforces database-level concurrency safety against duplicate seat booking.
-- On cancellation, active rows are removed (or archived) inside a SERIALIZABLE transaction.
CREATE TABLE IF NOT EXISTS booking_seats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    seat_id BIGINT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    category ENUM('SILVER', 'GOLD', 'PLATINUM') NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_booking_seats_booking FOREIGN KEY (booking_id)
        REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_seats_show FOREIGN KEY (show_id)
        REFERENCES shows(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_seats_seat FOREIGN KEY (seat_id)
        REFERENCES seats(id) ON DELETE CASCADE,
    UNIQUE KEY uk_show_seat_lock (show_id, seat_id)
) ENGINE=InnoDB;

-- 9. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('UPI', 'DEBIT_CARD', 'CREDIT_CARD', 'NET_BANKING') NOT NULL,
    payment_details VARCHAR(120) NULL,
    transaction_id VARCHAR(64) NOT NULL UNIQUE,
    status ENUM('SUCCESS', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'SUCCESS',
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id)
        REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB;
