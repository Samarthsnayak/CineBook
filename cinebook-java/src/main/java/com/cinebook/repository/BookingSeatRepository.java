package com.cinebook.repository;

import com.cinebook.entity.BookingSeat;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface BookingSeatRepository extends JpaRepository<BookingSeat, Long> {

    @Query("SELECT bs.seat.id FROM BookingSeat bs WHERE bs.show.id = :showId")
    List<Long> findBookedSeatIdsByShowId(@Param("showId") Long showId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT bs FROM BookingSeat bs WHERE bs.show.id = :showId AND bs.seat.id IN :seatIds")
    List<BookingSeat> findConflictingSeatsForUpdate(@Param("showId") Long showId,
                                                    @Param("seatIds") List<Long> seatIds);

    @Modifying
    @Query("DELETE FROM BookingSeat bs WHERE bs.booking.id = :bookingId")
    void deleteAllByBookingId(@Param("bookingId") Long bookingId);
}
