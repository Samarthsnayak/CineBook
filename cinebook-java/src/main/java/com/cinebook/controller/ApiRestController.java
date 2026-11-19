package com.cinebook.controller;

import com.cinebook.dto.*;
import com.cinebook.entity.Booking;
import com.cinebook.entity.Movie;
import com.cinebook.entity.Show;
import com.cinebook.entity.Theatre;
import com.cinebook.entity.User;
import com.cinebook.service.*;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiRestController {

    private final MovieService movieService;
    private final TheatreService theatreService;
    private final ShowService showService;
    private final BookingService bookingService;
    private final UserService userService;
    private final QrCodeService qrCodeService;
    private final TmdbService tmdbService;

    public ApiRestController(MovieService movieService, TheatreService theatreService,
                             ShowService showService, BookingService bookingService,
                             UserService userService, QrCodeService qrCodeService,
                             TmdbService tmdbService) {
        this.movieService = movieService;
        this.theatreService = theatreService;
        this.showService = showService;
        this.bookingService = bookingService;
        this.userService = userService;
        this.qrCodeService = qrCodeService;
        this.tmdbService = tmdbService;
    }

    @GetMapping("/auth/me")
    public ResponseEntity<?> currentUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.ok(Map.of("authenticated", false));
        }
        User user = userService.findByEmail(auth.getName());
        return ResponseEntity.ok(Map.of(
            "authenticated", true,
            "user", Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "phone", user.getPhone(),
                "role", user.getRole().name()
            )
        ));
    }

    @GetMapping("/movies")
    public Map<String, Object> listMovies(@RequestParam(required = false) String q,
                                          @RequestParam(required = false) String language,
                                          @RequestParam(required = false) String genre,
                                          @RequestParam(required = false) String status) {
        Movie.MovieStatus parsedStatus = null;
        if ("NOW_SHOWING".equalsIgnoreCase(status)) parsedStatus = Movie.MovieStatus.NOW_SHOWING;
        else if ("UPCOMING".equalsIgnoreCase(status)) parsedStatus = Movie.MovieStatus.UPCOMING;
        return Map.of(
            "movies", movieService.searchMovies(q, language, genre, parsedStatus),
            "tmdbConfigured", tmdbService.isConfigured()
        );
    }

    @GetMapping("/movies/{id}")
    public Movie getMovie(@PathVariable Long id) {
        return movieService.getById(id);
    }

    @GetMapping("/theatres")
    public List<Theatre> listTheatres(@RequestParam(required = false) String city) {
        return theatreService.getTheatresByCity(city);
    }

    @GetMapping("/shows")
    public List<Show> listShows(@RequestParam Long movieId,
                                @RequestParam(required = false) String city,
                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return showService.getShowsForMovie(movieId, city, date);
    }

    @GetMapping("/shows/{showId}/seats")
    public List<SeatStatusDto> getSeatLayout(@PathVariable Long showId) {
        return showService.getSeatLayoutForShow(showId);
    }

    @PostMapping("/bookings/checkout")
    public ResponseEntity<?> checkout(@Valid @RequestBody CheckoutRequest request, Authentication auth) {
        try {
            User user = userService.findByEmail(auth.getName());
            Booking booking = bookingService.completeBooking(user, request);
            String qr = qrCodeService.generateQrCodeBase64("CINEBOOK|" + booking.getBookingReference(), 220, 220);
            return ResponseEntity.status(201).body(Map.of("booking", booking, "qrCode", qr));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/bookings/my")
    public List<Booking> myBookings(Authentication auth) {
        User user = userService.findByEmail(auth.getName());
        return bookingService.getUserBookings(user.getId());
    }

    @GetMapping("/bookings/{ref}")
    public ResponseEntity<?> getBookingByRef(@PathVariable String ref, Authentication auth) {
        User user = userService.findByEmail(auth.getName());
        Booking booking = bookingService.getByReference(ref);
        if (user.getRole() != User.Role.ADMIN && !booking.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to view this booking."));
        }
        String qr = qrCodeService.generateQrCodeBase64("CINEBOOK|" + booking.getBookingReference(), 220, 220);
        return ResponseEntity.ok(Map.of("booking", booking, "qrCode", qr));
    }

    @PostMapping("/bookings/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable Long id, Authentication auth) {
        try {
            User user = userService.findByEmail(auth.getName());
            return ResponseEntity.ok(bookingService.cancelBooking(id, user));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/admin/stats")
    public DashboardStatsDto adminStats() {
        return bookingService.getAdminStats();
    }

    @PostMapping("/admin/tmdb/sync")
    public Map<String, Object> syncTmdb() {
        return tmdbService.syncIndianMovies();
    }

    @PostMapping("/admin/movies")
    public Movie createOrUpdateMovie(@Valid @RequestBody MovieFormDto dto) {
        return movieService.saveFromDto(dto);
    }

    @DeleteMapping("/admin/movies/{id}")
    public ResponseEntity<?> deleteMovie(@PathVariable Long id) {
        movieService.deleteMovie(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @PostMapping("/admin/shows")
    public Show createShow(@Valid @RequestBody ShowFormDto dto) {
        return showService.scheduleShow(dto);
    }
}
