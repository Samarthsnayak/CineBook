package com.cinebook.repository;

import com.cinebook.entity.Show;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface ShowRepository extends JpaRepository<Show, Long> {
    List<Show> findByMovieIdOrderByShowDateAscShowTimeAsc(Long movieId);

    @Query("SELECT s FROM Show s WHERE s.movie.id = :movieId " +
           "AND (:city IS NULL OR LOWER(s.screen.theatre.city) = LOWER(:city)) " +
           "AND (:showDate IS NULL OR s.showDate = :showDate) " +
           "ORDER BY s.screen.theatre.name ASC, s.showDate ASC, s.showTime ASC")
    List<Show> findFilteredShows(@Param("movieId") Long movieId,
                                 @Param("city") String city,
                                 @Param("showDate") LocalDate showDate);

    List<Show> findByScreenTheatreIdOrderByShowDateAscShowTimeAsc(Long theatreId);
}
