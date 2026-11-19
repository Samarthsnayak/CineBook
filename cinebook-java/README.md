# CineBook – Online Movie Ticket Booking System (Java Spring Boot + MySQL)

CineBook is a complete, production-structured full-stack Online Movie Ticket Booking Web Application inspired by BookMyShow, built with **Java 17**, **Spring Boot 3**, **Spring MVC**, **Spring Data JPA / Hibernate**, **Spring Security**, **Thymeleaf**, **Bootstrap 5**, and **MySQL 8**.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Java 17+, Spring Boot 3.3.5, Spring MVC, Spring Data JPA, Hibernate, Spring Security (BCrypt), Bean Validation, REST APIs, ZXing QR Generator |
| **Frontend** | HTML5, CSS3, JavaScript (ES6), Bootstrap 5.3, Thymeleaf 3 |
| **Database** | MySQL 8.0 (9 normalized relational tables with foreign keys & seat-level unique lock) |
| **Build Tool** | Apache Maven 3.9+ |

---

## Prerequisites Installation

### 1. Install Java JDK 17 (or JDK 21)
- Download from [Adoptium Temurin JDK 17](https://adoptium.net/) or Oracle JDK.
- Verify in terminal:
  ```bash
  java -version
  ```

### 2. Install Apache Maven
- Download from [maven.apache.org](https://maven.apache.org/download.cgi) and add `bin/` to your system `PATH`.
- Verify in terminal:
  ```bash
  mvn -version
  ```

### 3. Install & Configure MySQL 8
- Install MySQL Community Server & MySQL Workbench.
- Start the MySQL service and run the schema script:
  ```bash
  mysql -u root -p < sql/schema.sql
  ```
- Open `src/main/resources/application.properties` and update your MySQL credentials if different from `root` / `root`:
  ```properties
  spring.datasource.username=root
  spring.datasource.password=YOUR_MYSQL_PASSWORD
  ```

---

## Running the Project

### Option A: Run from Terminal (Maven)
```bash
cd cinebook-java
mvn clean spring-boot:run
```
Open your browser at **http://localhost:8080**

### Option B: Run in IntelliJ IDEA
1. Open IntelliJ IDEA → **File → Open** → select the `cinebook-java/pom.xml` file and choose **Open as Project**.
2. Wait for Maven to download dependencies automatically.
3. Verify JDK 17+ is selected under **File → Project Structure → Project SDK**.
4. Open `src/main/java/com/cinebook/CineBookApplication.java` and click the green **Run** icon.
5. Visit **http://localhost:8080**.

### Option C: Run in VS Code
1. Install the **Extension Pack for Java** and **Spring Boot Extension Pack** from the VS Code Marketplace.
2. Open the `cinebook-java` folder in VS Code.
3. Open `src/main/java/com/cinebook/CineBookApplication.java` and click **Run** above `main()`, or run `mvn spring-boot:run` in the integrated terminal.

---

## Optional Live Indian Cinema Sync (TMDB API)

CineBook prioritizes real Indian movies across **Kannada, Hindi, Tamil, Telugu, and Malayalam**. To fetch live official posters, synopses, and TMDB ratings directly on the backend (never exposing your API key to the browser):

```bash
export TMDB_API_KEY="your_tmdb_v3_api_key"
mvn clean spring-boot:run
```

Then sign in as an Administrator (`admin@cinebook.com`) and click **Sync Indian Movies (TMDB)** in the Admin Dashboard (or POST `/api/admin/tmdb/sync`). When `TMDB_API_KEY` is not set, CineBook gracefully serves its verified Indian cinema database catalog without fabricating posters or ratings.

---

## Default Demo Accounts (Seeded Automatically on First Startup)

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@cinebook.com` | `Admin@123` |
| **Customer** | `user@cinebook.com` | `User@123` |

---

## REST API Endpoints

- `GET /api/auth/me` — Verify active persistent session
- `GET /api/movies?q=&language=&genre=&status=` — Search & filter movies (Kannada, Hindi, Tamil, Telugu, Malayalam)
- `GET /api/movies/{id}` — Movie details
- `GET /api/shows?movieId=&city=&date=` — Theatres & showtimes by city and date
- `GET /api/shows/{showId}/seats` — Real-time seat layout & availability
- `POST /api/bookings/checkout` — Idempotent transactional seat booking, 18% GST tax calculation & simulated payment
- `GET /api/bookings/my` — Authenticated user's persisted bookings (strictly scoped to logged-in user)
- `GET /api/bookings/{ref}` — Retrieve persisted digital ticket & QR code (owner/admin only)
- `POST /api/bookings/{id}/cancel` — Cancel booking per 2-hour cancellation policy
- `GET /api/admin/stats` — Admin dashboard KPIs
- `POST /api/admin/tmdb/sync` — Sync live Indian cinema data from TMDB (Admin only)
- `POST/DELETE /api/admin/movies` — Admin movie management
- `POST /api/admin/shows` — Admin showtime scheduling

---

## Concurrency Control, Idempotency & Duplicate Seat Prevention

CineBook prevents duplicate bookings and double-booked seats using three layers of protection:
1. **Payment Idempotency Key**: `bookings.idempotency_key` (`UNIQUE`) prevents accidental duplicate bookings if a user clicks **Pay Amount and Generate Ticket** multiple times.
2. **JPA Serializable Transaction & Pessimistic Locking**: `BookingService.completeBooking()` runs inside `@Transactional(isolation = Isolation.SERIALIZABLE)` and verifies seat availability with `LockModeType.PESSIMISTIC_WRITE` before persisting.
3. **MySQL Composite Unique Key**: `booking_seats` enforces `UNIQUE KEY uk_show_seat_lock (show_id, seat_id)` so the database engine guarantees zero duplicate seat reservations even under high concurrency.
