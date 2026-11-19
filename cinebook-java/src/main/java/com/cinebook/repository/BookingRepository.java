package com.cinebook.repository;

import com.cinebook.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByUserIdOrderByBookedAtDesc(Long userId);
    List<Booking> findAllByOrderByBookedAtDesc();
    Optional<Booking> findByBookingReference(String bookingReference);
    Optional<Booking> findByIdempotencyKey(String idempotencyKey);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Booking b WHERE b.status = 'CONFIRMED'")
    BigDecimal sumConfirmedRevenue();

    long countByStatus(Booking.BookingStatus status);
}
