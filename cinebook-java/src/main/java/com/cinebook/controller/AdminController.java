package com.cinebook.controller;

import com.cinebook.dto.MovieFormDto;
import com.cinebook.dto.ShowFormDto;
import com.cinebook.service.*;
import jakarta.validation.Valid;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/admin")
public class AdminController {

    private final BookingService bookingService;
    private final MovieService movieService;
    private final TheatreService theatreService;
    private final ShowService showService;
    private final UserService userService;
    private final TmdbService tmdbService;

    public AdminController(BookingService bookingService, MovieService movieService,
                           TheatreService theatreService, ShowService showService,
                           UserService userService, TmdbService tmdbService) {
        this.bookingService = bookingService;
        this.movieService = movieService;
        this.theatreService = theatreService;
        this.showService = showService;
        this.userService = userService;
        this.tmdbService = tmdbService;
    }

    @GetMapping
    public String dashboard(Model model) {
        model.addAttribute("stats", bookingService.getAdminStats());
        model.addAttribute("movies", movieService.getAllMovies());
        model.addAttribute("theatres", theatreService.getAllTheatres());
        model.addAttribute("screens", theatreService.getAllScreens());
        model.addAttribute("shows", showService.getAllShows());
        model.addAttribute("bookings", bookingService.getAllBookings());
        model.addAttribute("users", userService.findAllUsers());
        model.addAttribute("tmdbConfigured", tmdbService.isConfigured());
        model.addAttribute("movieForm", new MovieFormDto());
        model.addAttribute("showForm", new ShowFormDto());
        return "admin/dashboard";
    }

    @PostMapping("/tmdb/sync")
    public String syncTmdb(RedirectAttributes redirectAttributes) {
        var result = tmdbService.syncIndianMovies();
        redirectAttributes.addFlashAttribute("successMessage", result.get("message"));
        return "redirect:/admin";
    }

    @PostMapping("/movies")
    public String saveMovie(@Valid @ModelAttribute("movieForm") MovieFormDto dto,
                            BindingResult result,
                            RedirectAttributes redirectAttributes) {
        if (result.hasErrors()) {
            redirectAttributes.addFlashAttribute("errorMessage", "Please fill in all required movie fields correctly.");
            return "redirect:/admin";
        }
        movieService.saveFromDto(dto);
        redirectAttributes.addFlashAttribute("successMessage", "Movie saved successfully.");
        return "redirect:/admin";
    }

    @PostMapping("/movies/{id}/delete")
    public String deleteMovie(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        movieService.deleteMovie(id);
        redirectAttributes.addFlashAttribute("successMessage", "Movie removed from catalog.");
        return "redirect:/admin";
    }

    @PostMapping("/theatres")
    public String addTheatre(@RequestParam String name,
                             @RequestParam String city,
                             @RequestParam String address,
                             @RequestParam(defaultValue = "Dolby Atmos, 4K Laser") String amenities,
                             RedirectAttributes redirectAttributes) {
        theatreService.addTheatre(name, city, address, amenities);
        redirectAttributes.addFlashAttribute("successMessage", "Theatre and default 64-seat screen added.");
        return "redirect:/admin";
    }

    @PostMapping("/screens")
    public String addScreen(@RequestParam Long theatreId,
                            @RequestParam String name,
                            @RequestParam(defaultValue = "Dolby Atmos") String format,
                            RedirectAttributes redirectAttributes) {
        theatreService.addScreenWithDefaultSeats(theatreId, name, format);
        redirectAttributes.addFlashAttribute("successMessage", "New screen with 64 Silver/Gold/Platinum seats created.");
        return "redirect:/admin";
    }

    @PostMapping("/shows")
    public String scheduleShow(@Valid @ModelAttribute("showForm") ShowFormDto dto,
                               BindingResult result,
                               RedirectAttributes redirectAttributes) {
        if (result.hasErrors()) {
            redirectAttributes.addFlashAttribute("errorMessage", "Please provide valid showtime and ticket prices.");
            return "redirect:/admin";
        }
        showService.scheduleShow(dto);
        redirectAttributes.addFlashAttribute("successMessage", "Showtime scheduled successfully.");
        return "redirect:/admin";
    }

    @PostMapping("/shows/{id}/delete")
    public String deleteShow(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        showService.deleteShow(id);
        redirectAttributes.addFlashAttribute("successMessage", "Showtime deleted.");
        return "redirect:/admin";
    }
}
