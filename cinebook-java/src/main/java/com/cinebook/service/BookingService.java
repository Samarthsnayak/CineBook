package com.cinebook.service;

import com.cinebook.dto.CheckoutRequest;
import com.cinebook.dto.DashboardStatsDto;
import com.cinebook.entity.*;
import com.cinebook.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class BookingService {

    private static final BigDecimal CONVENIENCE_FEE_PER_TICKET = BigDecimal.valueOf(30);
    private static final BigDecimal GST_RATE = new BigDecimal("0.18");

    private final BookingRepository bookingRepository;
    private final BookingSeatRepository bookingSeatRepository;
    private final PaymentRepository paymentRepository;
    private final ShowRepository showRepository;
    private final SeatRepository seatRepository;
    private final MovieRepository movieRepository;
    private final TheatreRepository theatreRepository;
    private final UserRepository userRepository;

    public BookingService(BookingRepository bookingRepository,
                          BookingSeatRepository bookingSeatRepository,
                          PaymentRepository paymentRepository,
                          ShowRepository showRepository,
                          SeatRepository seatRepository,
                          MovieRepository movieRepository,
                          TheatreRepository theatreRepository,
                          UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.bookingSeatRepository = bookingSeatRepository;
        this.paymentRepository = paymentRepository;
        this.showRepository = showRepository;
        this.seatRepository = seatRepository;
        this.movieRepository = movieRepository;
        this.theatreRepository = theatreRepository;
        this.userRepository = userRepository;
    }

    public BigDecimal calculateConvenienceFee(int seatCount) {
        return CONVENIENCE_FEE_PER_TICKET.multiply(BigDecimal.valueOf(seatCount)).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    public BigDecimal calculateGstTax(BigDecimal convenienceFee) {
        return convenienceFee.multiply(GST_RATE).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /**
     * Atomically verifies idempotency, checks seat availability with PESSIMISTIC_WRITE lock,
     * simulates payment, calculates 18% GST on convenience fees, persists booking + seats + payment,
     * and returns the freshly persisted booking from MySQL.
     */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Booking completeBooking(User user, CheckoutRequest request) {
        if (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()) {
            var existing = bookingRepository.findByIdempotencyKey(request.getIdempotencyKey().trim());
            if (existing.isPresent()) {
                Booking found = existing.get();
                if (!found.getUser().getId().equals(user.getId())) {
                    throw new SecurityException("Idempotency key belongs to another account.");
                }
                return found;
            }
        }

        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new IllegalArgumentException("Please select at least one seat.");
        }
        if (request.getSeatIds().size() > 10) {
            throw new IllegalArgumentException("You can book at most 10 seats per transaction.");
        }

        Show show = showRepository.findById(request.getShowId())
                .orElseThrow(() -> new IllegalArgumentException("Selected show no longer exists."));

        // 1. Pessimistic lock check to prevent race conditions & double-booking
        List<BookingSeat> conflicts = bookingSeatRepository.findConflictingSeatsForUpdate(
                show.getId(), request.getSeatIds()
        );
        if (!conflicts.isEmpty()) {
            String taken = conflicts.stream().map(BookingSeat::getSeatNumber)
                    .reduce((a, b) -> a + ", " + b).orElse("");
            throw new IllegalStateException("Seat(s) " + taken + " were just booked by another user. Please choose different seats.");
        }

        // 2. Load seats & compute verified server-side pricing
        List<Seat> seats = seatRepository.findAllById(request.getSeatIds());
        if (seats.size() != request.getSeatIds().size()) {
            throw new IllegalArgumentException("One or more selected seats are invalid.");
        }
        for (Seat seat : seats) {
            if (!seat.getScreen().getId().equals(show.getScreen().getId())) {
                throw new IllegalArgumentException("Seat " + seat.getSeatNumber() + " does not belong to this screen.");
            }
        }

        // 3. Simulated Payment Processing (no booking persisted if payment fails)
        if (request.isSimulateFailure()) {
            throw new IllegalStateException("Simulated Payment Declined by Bank Gateway. No booking was created and no amount was charged.");
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        for (Seat seat : seats) {
            subtotal = subtotal.add(show.getPriceForCategory(seat.getCategory()));
        }
        subtotal = subtotal.setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal fee = calculateConvenienceFee(seats.size());
        BigDecimal tax = calculateGstTax(fee);
        BigDecimal total = subtotal.add(fee).add(tax).setScale(2, java.math.RoundingMode.HALF_UP);
        String seatSummary = seats.stream().map(Seat::getSeatNumber).sorted().reduce((a, b) -> a + ", " + b).orElse("");

        // 4. Create Booking
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        String bookingRef = "CB-" + datePart + "-" + randomSuffix;

        Booking booking = new Booking();
        booking.setBookingReference(bookingRef);
        if (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()) {
            booking.setIdempotencyKey(request.getIdempotencyKey().trim());
        }
        booking.setUser(user);
        booking.setShow(show);
        booking.setTicketCount(seats.size());
        booking.setSeatSummary(seatSummary);
        booking.setSubtotalAmount(subtotal);
        booking.setConvenienceFee(fee);
        booking.setTaxAmount(tax);
        booking.setTotalAmount(total);
        booking.setStatus(Booking.BookingStatus.CONFIRMED);
        booking = bookingRepository.save(booking);

        // 5. Persist BookingSeats (protected additionally by MySQL UNIQUE(show_id, seat_id))
        List<BookingSeat> bookingSeats = new ArrayList<>();
        for (Seat seat : seats) {
            bookingSeats.add(new BookingSeat(booking, show, seat, show.getPriceForCategory(seat.getCategory())));
        }
        bookingSeatRepository.saveAll(bookingSeats);
        booking.setBookingSeats(bookingSeats);

        // 6. Persist Simulated Payment record
        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setAmount(total);
        payment.setPaymentMethod(request.getPaymentMethod());
        payment.setPaymentDetails(request.getPaymentDetails());
        payment.setTransactionId("TXN-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase());
        payment.setStatus(Payment.PaymentStatus.SUCCESS);
        paymentRepository.save(payment);
        booking.setPayment(payment);

        // Reload verified persisted record from DB
        return bookingRepository.findByBookingReference(bookingRef).orElse(booking);
    }

    /**
     * Cancels a confirmed booking if showtime is at least 2 hours away, releases the locked seats,
     * and updates the payment record to REFUNDED.
     */
    @Transactional
    public Booking cancelBooking(Long bookingId, User currentUser) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found."));

        boolean isAdmin = currentUser.getRole() == User.Role.ADMIN;
        if (!isAdmin && !booking.getUser().getId().equals(currentUser.getId())) {
            throw new SecurityException("You are not authorized to cancel this booking.");
        }
        if (booking.getStatus() == Booking.BookingStatus.CANCELLED) {
            throw new IllegalStateException("This booking has already been cancelled.");
        }

        LocalDateTime showDateTime = LocalDateTime.of(booking.getShow().getShowDate(), booking.getShow().getShowTime());
        if (!isAdmin && showDateTime.isBefore(LocalDateTime.now().plusHours(2))) {
            throw new IllegalStateException("Cancellation Policy: Tickets can only be cancelled at least 2 hours before showtime.");
        }

        booking.setStatus(Booking.BookingStatus.CANCELLED);
        booking.setCancelledAt(LocalDateTime.now());

        // Release seats so other users can book them
        bookingSeatRepository.deleteAllByBookingId(booking.getId());
        booking.getBookingSeats().clear();

        if (booking.getPayment() != null) {
            booking.getPayment().setStatus(Payment.PaymentStatus.REFUNDED);
            paymentRepository.save(booking.getPayment());
        }

        return bookingRepository.save(booking);
    }

    public Booking getByReference(String ref) {
        return bookingRepository.findByBookingReference(ref)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found: " + ref));
    }

    public List<Booking> getUserBookings(Long userId) {
        return bookingRepository.findByUserIdOrderByBookedAtDesc(userId);
    }

    public List<Booking> getAllBookings() {
        return bookingRepository.findAllByOrderByBookedAtDesc();
    }

    public DashboardStatsDto getAdminStats() {
        return new DashboardStatsDto(
            bookingRepository.sumConfirmedRevenue(),
            bookingRepository.countByStatus(Booking.BookingStatus.CONFIRMED),
            bookingRepository.countByStatus(Booking.BookingStatus.CANCELLED),
            movieRepository.count(),
            theatreRepository.count(),
            showRepository.count(),
            userRepository.count()
        );
    }
}
