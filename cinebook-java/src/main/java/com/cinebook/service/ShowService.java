package com.cinebook.service;

import com.cinebook.dto.SeatStatusDto;
import com.cinebook.dto.ShowFormDto;
import com.cinebook.entity.Movie;
import com.cinebook.entity.Screen;
import com.cinebook.entity.Seat;
import com.cinebook.entity.Show;
import com.cinebook.repository.BookingSeatRepository;
import com.cinebook.repository.MovieRepository;
import com.cinebook.repository.ScreenRepository;
import com.cinebook.repository.SeatRepository;
import com.cinebook.repository.ShowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ShowService {

    private final ShowRepository showRepository;
    private final MovieRepository movieRepository;
    private final ScreenRepository screenRepository;
    private final SeatRepository seatRepository;
    private final BookingSeatRepository bookingSeatRepository;

    public ShowService(ShowRepository showRepository, MovieRepository movieRepository,
                       ScreenRepository screenRepository, SeatRepository seatRepository,
                       BookingSeatRepository bookingSeatRepository) {
        this.showRepository = showRepository;
        this.movieRepository = movieRepository;
        this.screenRepository = screenRepository;
        this.seatRepository = seatRepository;
        this.bookingSeatRepository = bookingSeatRepository;
    }

    public Show getById(Long id) {
        return showRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Show not found with ID: " + id));
    }

    public List<Show> getAllShows() {
        return showRepository.findAll();
    }

    public List<Show> getShowsForMovie(Long movieId, String city, LocalDate showDate) {
        String cleanCity = (city == null || city.isBlank() || city.equalsIgnoreCase("ALL")) ? null : city;
        return showRepository.findFilteredShows(movieId, cleanCity, showDate);
    }

    public List<SeatStatusDto> getSeatLayoutForShow(Long showId) {
        Show show = getById(showId);
        List<Seat> screenSeats = seatRepository.findByScreenIdOrderByRowLabelAscSeatColAsc(show.getScreen().getId());
        Set<Long> bookedIds = new HashSet<>(bookingSeatRepository.findBookedSeatIdsByShowId(showId));

        return screenSeats.stream()
                .map(seat -> new SeatStatusDto(
                    seat.getId(),
                    seat.getSeatNumber(),
                    seat.getRowLabel(),
                    seat.getSeatCol(),
                    seat.getCategory(),
                    show.getPriceForCategory(seat.getCategory()),
                    bookedIds.contains(seat.getId())
                ))
                .toList();
    }

    @Transactional
    public Show scheduleShow(ShowFormDto dto) {
        Movie movie = movieRepository.findById(dto.getMovieId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid movie ID"));
        Screen screen = screenRepository.findById(dto.getScreenId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid screen ID"));

        Show show = new Show(
            movie, screen, dto.getShowDate(), dto.getShowTime(),
            dto.getSilverPrice(), dto.getGoldPrice(), dto.getPlatinumPrice()
        );
        return showRepository.save(show);
    }

    @Transactional
    public void deleteShow(Long showId) {
        showRepository.deleteById(showId);
    }
}
