package com.cinebook.service;

import com.cinebook.dto.MovieFormDto;
import com.cinebook.entity.Movie;
import com.cinebook.repository.MovieRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class MovieService {

    private final MovieRepository movieRepository;

    public MovieService(MovieRepository movieRepository) {
        this.movieRepository = movieRepository;
    }

    public List<Movie> getAllMovies() {
        return movieRepository.findAll();
    }

    public List<Movie> getNowShowing() {
        return movieRepository.findVerifiedNowShowing();
    }

    public List<Movie> getUpcoming() {
        return movieRepository.findByStatusOrderByReleaseDateAsc(Movie.MovieStatus.UPCOMING);
    }

    public List<Movie> searchMovies(String query, String language, String genre, Movie.MovieStatus status) {
        String cleanQ = (query != null && !query.isBlank()) ? query.trim() : null;
        String cleanLang = (language != null && !language.isBlank() && !"ALL".equalsIgnoreCase(language)) ? language.trim() : null;
        String cleanGenre = (genre != null && !genre.isBlank() && !"ALL".equalsIgnoreCase(genre)) ? genre.trim() : null;
        return movieRepository.searchMovies(cleanQ, cleanLang, cleanGenre, status);
    }

    public List<Movie> searchByTitle(String query) {
        return searchMovies(query, null, null, null);
    }

    public Movie getById(Long id) {
        return movieRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Movie not found with ID: " + id));
    }

    @Transactional
    public Movie saveFromDto(MovieFormDto dto) {
        Movie movie = (dto.getId() != null) ? getById(dto.getId()) : new Movie();
        movie.setTitle(dto.getTitle().trim());
        movie.setDescription(dto.getDescription().trim());
        movie.setCastMembers(dto.getCastMembers().trim());
        movie.setDirector(dto.getDirector().trim());
        movie.setGenre(dto.getGenre().trim());
        movie.setLanguage(dto.getLanguage().trim());
        movie.setDurationMinutes(dto.getDurationMinutes());
        movie.setRating(dto.getRating());
        movie.setCertificate(dto.getCertificate());
        movie.setReleaseDate(dto.getReleaseDate());
        movie.setStatus(dto.getStatus());
        movie.setPosterUrl(dto.getPosterUrl() != null ? dto.getPosterUrl().trim() : "");
        return movieRepository.save(movie);
    }

    @Transactional
    public void deleteMovie(Long id) {
        movieRepository.deleteById(id);
    }
}
