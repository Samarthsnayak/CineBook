package com.cinebook.repository;

import com.cinebook.entity.Movie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface MovieRepository extends JpaRepository<Movie, Long> {

    Optional<Movie> findByTmdbId(Long tmdbId);

    @Query("SELECT m FROM Movie m WHERE m.status = 'NOW_SHOWING' AND EXISTS (SELECT s.id FROM Show s WHERE s.movie.id = m.id) ORDER BY m.releaseDate DESC")
    List<Movie> findVerifiedNowShowing();

    List<Movie> findByStatusOrderByReleaseDateAsc(Movie.MovieStatus status);

    @Query("SELECT m FROM Movie m WHERE " +
           "(:q IS NULL OR LOWER(m.title) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(m.castMembers) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(m.director) LIKE LOWER(CONCAT('%', :q, '%'))) AND " +
           "(:language IS NULL OR LOWER(m.language) LIKE LOWER(CONCAT('%', :language, '%'))) AND " +
           "(:genre IS NULL OR LOWER(m.genre) LIKE LOWER(CONCAT('%', :genre, '%'))) AND " +
           "(:status IS NULL OR m.status = :status) AND " +
           "(:status IS NULL OR :status <> com.cinebook.entity.Movie$MovieStatus.NOW_SHOWING OR EXISTS (SELECT s.id FROM Show s WHERE s.movie.id = m.id)) " +
           "ORDER BY m.releaseDate DESC")
    List<Movie> searchMovies(@Param("q") String q,
                             @Param("language") String language,
                             @Param("genre") String genre,
                             @Param("status") Movie.MovieStatus status);
}
