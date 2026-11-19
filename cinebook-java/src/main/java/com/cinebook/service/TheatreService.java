package com.cinebook.service;

import com.cinebook.entity.Screen;
import com.cinebook.entity.Seat;
import com.cinebook.entity.Theatre;
import com.cinebook.repository.ScreenRepository;
import com.cinebook.repository.SeatRepository;
import com.cinebook.repository.TheatreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.List;

@Service
public class TheatreService {

    private final TheatreRepository theatreRepository;
    private final ScreenRepository screenRepository;
    private final SeatRepository seatRepository;

    public TheatreService(TheatreRepository theatreRepository,
                          ScreenRepository screenRepository,
                          SeatRepository seatRepository) {
        this.theatreRepository = theatreRepository;
        this.screenRepository = screenRepository;
        this.seatRepository = seatRepository;
    }

    public List<String> getAllCities() {
        return theatreRepository.findAllDistinctCities();
    }

    public List<Theatre> getAllTheatres() {
        return theatreRepository.findAll();
    }

    public List<Theatre> getTheatresByCity(String city) {
        if (city == null || city.isBlank() || city.equalsIgnoreCase("ALL")) {
            return getAllTheatres();
        }
        return theatreRepository.findByCityIgnoreCaseOrderByNameAsc(city);
    }

    public List<Screen> getAllScreens() {
        return screenRepository.findAll();
    }

    @Transactional
    public Theatre addTheatre(String name, String city, String address, String amenities) {
        Theatre theatre = theatreRepository.save(new Theatre(name.trim(), city.trim(), address.trim(), amenities));
        addScreenWithDefaultSeats(theatre.getId(), "Screen 1 - Dolby Atmos", "Dolby Atmos");
        return theatre;
    }

    @Transactional
    public Screen addScreenWithDefaultSeats(Long theatreId, String name, String format) {
        Theatre theatre = theatreRepository.findById(theatreId)
                .orElseThrow(() -> new IllegalArgumentException("Theatre not found: " + theatreId));
        Screen screen = screenRepository.save(new Screen(theatre, name.trim(), format, 64));

        String[] rows = {"A", "B", "C", "D", "E", "F", "G", "H"};
        List<Seat> seats = new ArrayList<>();
        for (int r = 0; r < rows.length; r++) {
            Seat.SeatCategory category = (r < 3) ? Seat.SeatCategory.SILVER
                    : (r < 6) ? Seat.SeatCategory.GOLD
                    : Seat.SeatCategory.PLATINUM;
            for (int c = 1; c <= 8; c++) {
                seats.add(new Seat(screen, rows[r] + c, rows[r], c, category));
            }
        }
        seatRepository.saveAll(seats);
        return screen;
    }
}
