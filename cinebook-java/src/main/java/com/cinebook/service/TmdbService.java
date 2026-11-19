package com.cinebook.service;

import com.cinebook.entity.Movie;
import com.cinebook.repository.MovieRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TmdbService {

    private static final Map<String, String> INDIAN_LANGUAGES = new LinkedHashMap<>();
    static {
        INDIAN_LANGUAGES.put("kn", "Kannada");
        INDIAN_LANGUAGES.put("hi", "Hindi");
        INDIAN_LANGUAGES.put("ta", "Tamil");
        INDIAN_LANGUAGES.put("te", "Telugu");
        INDIAN_LANGUAGES.put("ml", "Malayalam");
    }

    private final MovieRepository movieRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${tmdb.api.key:}")
    private String tmdbApiKey;

    @Value("${tmdb.api.base-url:https://api.themoviedb.org/3}")
    private String tmdbBaseUrl;

    public TmdbService(MovieRepository movieRepository) {
        this.movieRepository = movieRepository;
    }

    public boolean isConfigured() {
        return tmdbApiKey != null && !tmdbApiKey.isBlank();
    }

    @Transactional
    public Map<String, Object> syncIndianMovies() {
        if (!isConfigured()) {
            return Map.of(
                "synced", 0,
                "configured", false,
                "message", "TMDB_API_KEY is not configured. Showing verified Indian cinema database catalog."
            );
        }

        int syncedCount = 0;
        LocalDate today = LocalDate.now();
        String fromDate = today.minusDays(90).toString();
        String toDate = today.plusDays(180).toString();

        for (Map.Entry<String, String> entry : INDIAN_LANGUAGES.entrySet()) {
            String langCode = entry.getKey();
            String langName = entry.getValue();
            try {
                String url = tmdbBaseUrl + "/discover/movie?api_key=" + tmdbApiKey
                        + "&region=IN&with_original_language=" + langCode
                        + "&sort_by=popularity.desc"
                        + "&primary_release_date.gte=" + fromDate
                        + "&primary_release_date.lte=" + toDate
                        + "&page=1";

                JsonNode response = restTemplate.getForObject(url, JsonNode.class);
                if (response == null || !response.has("results")) continue;

                int perLang = 0;
                for (JsonNode item : response.get("results")) {
                    if (perLang >= 4) break;
                    long tmdbId = item.path("id").asLong(0);
                    String title = item.path("title").asText("").trim();
                    String releaseDateStr = item.path("release_date").asText("").trim();
                    if (tmdbId == 0 || title.isBlank() || releaseDateStr.isBlank()) continue;

                    LocalDate releaseDate = LocalDate.parse(releaseDateStr);
                    String posterPath = item.path("poster_path").asText("");
                    String posterUrl = posterPath.isBlank() ? "" : "https://image.tmdb.org/t/p/w500" + posterPath;
                    String overview = item.path("overview").asText("").trim();
                    if (overview.isBlank()) {
                        overview = "Official " + langName + " theatrical release listed via TMDB.";
                    }

                    double voteAvg = item.path("vote_average").asDouble(0.0);
                    int voteCount = item.path("vote_count").asInt(0);
                    BigDecimal rating = (voteCount >= 10 && voteAvg > 0)
                            ? BigDecimal.valueOf(voteAvg).setScale(1, RoundingMode.HALF_UP)
                            : null;

                    Movie movie = movieRepository.findByTmdbId(tmdbId).orElseGet(Movie::new);
                    movie.setTmdbId(tmdbId);
                    movie.setDataSource("TMDB");
                    movie.setTitle(title);
                    movie.setDescription(overview);
                    movie.setLanguage(langName);
                    movie.setGenre(movie.getGenre() != null ? movie.getGenre() : "Drama");
                    movie.setDirector(movie.getDirector() != null ? movie.getDirector() : "TBA");
                    movie.setCastMembers(movie.getCastMembers() != null ? movie.getCastMembers() : "Cast details via TMDB");
                    movie.setDurationMinutes(movie.getDurationMinutes() != null ? movie.getDurationMinutes() : 145);
                    movie.setRating(rating);
                    movie.setCertificate(movie.getCertificate() != null ? movie.getCertificate() : "UA");
                    movie.setReleaseDate(releaseDate);
                    movie.setStatus(releaseDate.isAfter(today) ? Movie.MovieStatus.UPCOMING : Movie.MovieStatus.NOW_SHOWING);
                    if (!posterUrl.isBlank()) {
                        movie.setPosterUrl(posterUrl);
                    }
                    movieRepository.save(movie);
                    syncedCount++;
                    perLang++;
                }
            } catch (Exception ignored) {
                // Keep previously verified DB catalog intact if TMDB is unreachable
            }
        }

        return Map.of(
            "synced", syncedCount,
            "configured", true,
            "languages", List.copyOf(INDIAN_LANGUAGES.values()),
            "message", "Synced " + syncedCount + " real Indian movies from TMDB."
        );
    }
}
