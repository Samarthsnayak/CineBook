package com.cinebook.controller;

import com.cinebook.entity.Movie;
import com.cinebook.entity.Show;
import com.cinebook.entity.Theatre;
import com.cinebook.service.MovieService;
import com.cinebook.service.ShowService;
import com.cinebook.service.TheatreService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
public class HomeController {

    private static final List<String> INDIAN_LANGUAGES = List.of("Kannada", "Hindi", "Tamil", "Telugu", "Malayalam");
    private static final List<String> GENRES = List.of("Action", "Comedy", "Drama", "Thriller", "Romance", "Adventure");

    private final MovieService movieService;
    private final TheatreService theatreService;
    private final ShowService showService;
    private final com.cinebook.service.TmdbService tmdbService;

    public HomeController(MovieService movieService, TheatreService theatreService,
                          ShowService showService, com.cinebook.service.TmdbService tmdbService) {
        this.movieService = movieService;
        this.theatreService = theatreService;
        this.showService = showService;
        this.tmdbService = tmdbService;
    }

    @GetMapping("/")
    public String home(@RequestParam(required = false) String q,
                       @RequestParam(required = false) String language,
                       Model model) {
        if (q != null && !q.isBlank()) {
            model.addAttribute("searchQuery", q);
            model.addAttribute("searchResults", movieService.searchMovies(q, language, null, null));
        }
        model.addAttribute("nowShowing", movieService.searchMovies(null, language, null, Movie.MovieStatus.NOW_SHOWING));
        model.addAttribute("upcomingMovies", movieService.searchMovies(null, language, null, Movie.MovieStatus.UPCOMING));
        model.addAttribute("languages", INDIAN_LANGUAGES);
        model.addAttribute("selectedLanguage", language);
        model.addAttribute("tmdbConfigured", tmdbService.isConfigured());
        model.addAttribute("cities", theatreService.getAllCities());
        return "index";
    }

    @GetMapping("/movies")
    public String movies(@RequestParam(required = false) String q,
                         @RequestParam(required = false) String language,
                         @RequestParam(required = false) String genre,
                         @RequestParam(required = false) String status,
                         Model model) {
        Movie.MovieStatus parsedStatus = null;
        if ("UPCOMING".equalsIgnoreCase(status)) {
            parsedStatus = Movie.MovieStatus.UPCOMING;
        } else if ("NOW_SHOWING".equalsIgnoreCase(status)) {
            parsedStatus = Movie.MovieStatus.NOW_SHOWING;
        }
        List<Movie> list = movieService.searchMovies(q, language, genre, parsedStatus);
        model.addAttribute("movies", list);
        model.addAttribute("searchQuery", q);
        model.addAttribute("selectedLanguage", language);
        model.addAttribute("selectedGenre", genre);
        model.addAttribute("selectedStatus", status);
        model.addAttribute("languages", INDIAN_LANGUAGES);
        model.addAttribute("genres", GENRES);
        model.addAttribute("tmdbConfigured", tmdbService.isConfigured());
        return "movies";
    }

    @GetMapping("/movies/{id}")
    public String movieDetails(@PathVariable Long id,
                               @RequestParam(required = false) String city,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                               Model model) {
        Movie movie = movieService.getById(id);
        LocalDate selectedDate = (date != null) ? date : LocalDate.now();
        List<String> cities = theatreService.getAllCities();
        String selectedCity = (city != null && !city.isBlank()) ? city : (cities.isEmpty() ? null : cities.get(0));

        List<Show> shows = showService.getShowsForMovie(id, selectedCity, selectedDate);
        Map<Theatre, List<Show>> showsByTheatre = shows.stream()
                .collect(Collectors.groupingBy(s -> s.getScreen().getTheatre(), LinkedHashMap::new, Collectors.toList()));

        List<LocalDate> upcomingDates = List.of(
            LocalDate.now(), LocalDate.now().plusDays(1), LocalDate.now().plusDays(2)
        );

        model.addAttribute("movie", movie);
        model.addAttribute("cities", cities);
        model.addAttribute("selectedCity", selectedCity);
        model.addAttribute("upcomingDates", upcomingDates);
        model.addAttribute("selectedDate", selectedDate);
        model.addAttribute("showsByTheatre", showsByTheatre);
        return "movie-details";
    }

    @GetMapping("/theatres")
    public String theatres(@RequestParam(required = false) String city, Model model) {
        model.addAttribute("cities", theatreService.getAllCities());
        model.addAttribute("selectedCity", city);
        model.addAttribute("theatres", theatreService.getTheatresByCity(city));
        return "theatres";
    }
}
