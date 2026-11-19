package com.cinebook.config;

import com.cinebook.entity.*;
import com.cinebook.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final MovieRepository movieRepository;
    private final TheatreRepository theatreRepository;
    private final ScreenRepository screenRepository;
    private final SeatRepository seatRepository;
    private final ShowRepository showRepository;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(UserRepository userRepository, MovieRepository movieRepository,
                      TheatreRepository theatreRepository, ScreenRepository screenRepository,
                      SeatRepository seatRepository, ShowRepository showRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.movieRepository = movieRepository;
        this.theatreRepository = theatreRepository;
        this.screenRepository = screenRepository;
        this.seatRepository = seatRepository;
        this.showRepository = showRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() == 0) {
            userRepository.save(new User(
                "CineBook Administrator", "admin@cinebook.com", "9876543210",
                passwordEncoder.encode("Admin@123"), User.Role.ADMIN
            ));
            userRepository.save(new User(
                "Aarav Sharma", "user@cinebook.com", "9820112233",
                passwordEncoder.encode("User@123"), User.Role.USER
            ));
        }

        if (movieRepository.count() == 0) {
            List<Movie> movies = createSampleMovies();
            movieRepository.saveAll(movies);

            List<Screen> screens = createSampleTheatresAndScreens();
            scheduleInitialShows(movies, screens);
        }
    }

    private List<Movie> createSampleMovies() {
        List<Movie> list = new ArrayList<>();

        list.add(buildMovie(
            1213243L,
            "Toxic: A Fairy Tale for Grown-Ups",
            "Set against a brooding coastal underworld, a ruthless syndicate figure navigates betrayal, shifting power alliances, and a perilous legacy.",
            "Yash, Kiara Advani, Nayanthara, Huma Qureshi, Rukmini Vasanth",
            "Geetu Mohandas", "Action / Thriller", "Kannada", 158, null, "A",
            LocalDate.of(2026, 8, 26), Movie.MovieStatus.NOW_SHOWING, "/posters/toxic-2026.jpg"
        ));
        list.add(buildMovie(
            1083637L,
            "Kantara: Chapter 1",
            "Set in the Kadamba dynasty era of coastal Karnataka, this mythological period prequel traces the sacred origins of the Bhoota Kola guardian tradition.",
            "Rishab Shetty, Jayaram, Rukmini Vasanth, Gulshan Devaiah",
            "Rishab Shetty", "Action / Drama", "Kannada", 160, BigDecimal.valueOf(8.6), "UA",
            LocalDate.of(2025, 10, 2), Movie.MovieStatus.NOW_SHOWING, "/posters/kantara-chapter-1.jpg"
        ));
        list.add(buildMovie(
            656908L,
            "Ramayana: Part 1",
            "A grand theatrical retelling of the Indian epic chronicling the exile of Prince Rama, Sita, and Lakshmana, and the gathering confrontation with Lanka.",
            "Ranbir Kapoor, Sai Pallavi, Yash, Sunny Deol, Ravi Dubey",
            "Nitesh Tiwari", "Adventure / Drama", "Hindi", 180, null, "UA",
            LocalDate.of(2026, 11, 5), Movie.MovieStatus.NOW_SHOWING, "/posters/ramayana-part-1.jpg"
        ));
        list.add(buildMovie(
            1582770L,
            "Dhurandhar: The Revenge",
            "Following a high-stakes covert intelligence crisis, an elite Indian operative leads a relentless cross-border mission against an entrenched terror network.",
            "Ranveer Singh, Sanjay Dutt, R. Madhavan, Akshaye Khanna",
            "Aditya Dhar", "Action / Thriller", "Hindi", 165, null, "UA",
            LocalDate.of(2026, 3, 19), Movie.MovieStatus.NOW_SHOWING, "/posters/dhurandhar-the-revenge.jpg"
        ));
        list.add(buildMovie(
            1234139L,
            "Jailer 2",
            "Retired prison officer Muthuvel Pandian returns to confront a ruthless criminal cartel when a fresh threat strikes close to his family.",
            "Rajinikanth, S. J. Suryah, Mithun Chakraborty, Ramya Krishnan, Yogi Babu",
            "Nelson Dilipkumar", "Action / Comedy", "Tamil", 165, null, "UA",
            LocalDate.of(2026, 10, 15), Movie.MovieStatus.NOW_SHOWING, "/posters/jailer-2.jpg"
        ));
        list.add(buildMovie(
            1057265L,
            "Peddi",
            "In a fiercely spirited rural Andhra town, an underdog athlete rises through grit and local rivalry to unite his village on the biggest sporting stage.",
            "Ram Charan, Shiva Rajkumar, Janhvi Kapoor, Jagapathi Babu",
            "Buchi Babu Sana", "Action / Drama", "Telugu", 168, null, "UA",
            LocalDate.of(2026, 6, 4), Movie.MovieStatus.NOW_SHOWING, "/posters/peddi.jpg"
        ));
        list.add(buildMovie(
            1508168L,
            "Bethlehem Kudumba Unit",
            "A warm, comedic Kerala family drama following eccentric relatives whose chaotic reunion sparks unexpected romance and heartfelt reconciliation.",
            "Nivin Pauly, Mamitha Baiju, Sangeeth Prathap, Vinay Forrt",
            "Girish A.D.", "Comedy / Romance", "Malayalam", 144, null, "U",
            LocalDate.of(2026, 8, 21), Movie.MovieStatus.NOW_SHOWING, "/posters/bethlehem-kudumba-unit.jpg"
        ));
        list.add(buildMovie(
            847742L,
            "Drishyam 3",
            "Years after covering up a fateful night, Georgekutty faces a relentless new investigation that tests his wits and his family's unbreakable silence.",
            "Mohanlal, Meena, Ansiba Hassan, Esther Anil",
            "Jeethu Joseph", "Crime / Thriller", "Malayalam", 158, null, "UA",
            LocalDate.of(2026, 10, 2), Movie.MovieStatus.NOW_SHOWING, "/posters/drishyam-3.jpg"
        ));
        list.add(buildMovie(
            1145110L,
            "King",
            "A hardened underworld mentor trains a young protege through a perilous web of vendettas across international capitals.",
            "Shah Rukh Khan, Deepika Padukone, Suhana Khan, Abhishek Bachchan",
            "Siddharth Anand", "Action / Thriller", "Hindi", 150, null, "UA",
            LocalDate.of(2026, 12, 24), Movie.MovieStatus.UPCOMING, "/posters/king.jpg"
        ));
        list.add(buildMovie(
            1257973L,
            "Fauzi",
            "Set against a turbulent historical backdrop in pre-independence India, a defiant soldier challenges imperial rule in an epic tale of courage and sacrifice.",
            "Prabhas, Imanvi, Mithun Chakraborty, Jaya Prada",
            "Hanu Raghavapudi", "Action / Drama", "Telugu", 156, null, "UA",
            LocalDate.of(2026, 12, 3), Movie.MovieStatus.UPCOMING, "/posters/fauzi.jpg"
        ));
        list.add(buildMovie(
            1367220L,
            "Karuppu",
            "A lawyer drawn into a fiercely contested case discovers an ancient spiritual force guiding him to confront entrenched corruption and injustice.",
            "Suriya, Trisha Krishnan, Indrans, Swasika",
            "RJ Balaji", "Action / Drama", "Tamil", 152, null, "UA",
            LocalDate.of(2026, 12, 18), Movie.MovieStatus.UPCOMING, "/posters/karuppu.jpg"
        ));
        list.add(buildMovie(
            1122030L,
            "Alpha",
            "Two elite female intelligence agents in India's covert spy universe confront a ruthless international adversary in a high-octane espionage thriller.",
            "Alia Bhatt, Sharvari, Bobby Deol, Anil Kapoor",
            "Shiv Rawail", "Action / Thriller", "Hindi", 148, null, "UA",
            LocalDate.of(2026, 12, 25), Movie.MovieStatus.UPCOMING, "/posters/alpha.jpg"
        ));
        list.add(buildMovie(
            1103473L,
            "KD: The Devil",
            "Set in 1970s Bengaluru, a fearless gangster rises from the underworld in a stylized period action drama fueled by loyalty and vengeance.",
            "Dhruva Sarja, Sanjay Dutt, Shilpa Shetty, Reeshma Nanaiah, V. Ravichandran",
            "Prem", "Action / Thriller", "Kannada", 162, null, "UA",
            LocalDate.of(2026, 12, 11), Movie.MovieStatus.UPCOMING, "/posters/kd-the-devil.jpg"
        ));
        list.add(buildMovie(
            920708L,
            "Varanasi",
            "An ambitious globe-trotting action-adventure drawing on ancient Indian lore as an explorer embarks on an extraordinary expedition.",
            "Mahesh Babu, Priyanka Chopra, Prithviraj Sukumaran",
            "S. S. Rajamouli", "Adventure / Action", "Telugu", 180, null, "UA",
            LocalDate.of(2027, 4, 7), Movie.MovieStatus.UPCOMING, "/posters/varanasi.jpg"
        ));

        return list;
    }

    private Movie buildMovie(Long tmdbId, String title, String description, String cast, String director,
                             String genre, String language, int duration, BigDecimal rating,
                             String certificate, LocalDate releaseDate, Movie.MovieStatus status,
                             String posterUrl) {
        Movie m = new Movie();
        m.setTmdbId(tmdbId);
        m.setTitle(title);
        m.setDescription(description);
        m.setCastMembers(cast);
        m.setDirector(director);
        m.setGenre(genre);
        m.setLanguage(language);
        m.setDurationMinutes(duration);
        m.setRating(rating);
        m.setCertificate(certificate);
        m.setReleaseDate(releaseDate);
        m.setStatus(status);
        m.setPosterUrl(posterUrl);
        m.setDataSource("VERIFIED_INDIAN_CATALOG");
        return m;
    }

    private List<Screen> createSampleTheatresAndScreens() {
        List<Theatre> theatres = theatreRepository.saveAll(List.of(
            new Theatre("PVR Orion Grand Mall", "Bengaluru", "Dr Rajkumar Road, Rajajinagar, Bengaluru", "IMAX Laser, Dolby Atmos, Gold Lounge"),
            new Theatre("Cinepolis Royal Meenakshi", "Bengaluru", "Bannerghatta Main Road, Bengaluru", "4DX, Dolby 7.1, Food Court"),
            new Theatre("PVR ICON: Phoenix Palladium", "Mumbai", "Lower Parel, Senapati Bapat Marg, Mumbai", "IMAX Laser, Dolby Atmos, Recliners"),
            new Theatre("Sathyam Cinemas (SPI / PVR)", "Chennai", "Royapettah, Peters Road, Chennai", "Dolby Atmos, 4K RGB Laser, Signature Lounge"),
            new Theatre("AMB Cinemas: Gachibowli", "Hyderabad", "Gachibowli - Miyapur Road, Hyderabad", "M-Lounge, Barco Laser, Dolby Atmos"),
            new Theatre("PVR Lulu Mall Kochi", "Kochi", "Edappally, NH Bypass, Kochi", "P[XL] Laser, Dolby Atmos, Gourmet Cafe")
        ));

        List<Screen> allScreens = new ArrayList<>();
        for (Theatre theatre : theatres) {
            Screen s1 = screenRepository.save(new Screen(theatre, "Screen 1 - IMAX", "IMAX 2D", 64));
            Screen s2 = screenRepository.save(new Screen(theatre, "Screen 2 - Atmos", "Dolby Atmos", 64));
            generateSeatsForScreen(s1);
            generateSeatsForScreen(s2);
            allScreens.add(s1);
            allScreens.add(s2);
        }
        return allScreens;
    }

    public void generateSeatsForScreen(Screen screen) {
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
    }

    private void scheduleInitialShows(List<Movie> movies, List<Screen> screens) {
        List<Movie> running = movies.stream()
                .filter(m -> m.getStatus() == Movie.MovieStatus.NOW_SHOWING)
                .toList();

        LocalTime[] times = {
            LocalTime.of(10, 30), LocalTime.of(14, 15),
            LocalTime.of(18, 0), LocalTime.of(21, 30)
        };

        for (int dayOffset = 0; dayOffset < 3; dayOffset++) {
            LocalDate date = LocalDate.now().plusDays(dayOffset);
            for (int i = 0; i < screens.size(); i++) {
                Screen screen = screens.get(i);
                for (int t = 0; t < times.length; t++) {
                    Movie movie = running.get((i + t) % running.size());
                    boolean isEvening = times[t].getHour() >= 18;
                    BigDecimal silver = isEvening ? BigDecimal.valueOf(240) : BigDecimal.valueOf(180);
                    BigDecimal gold = isEvening ? BigDecimal.valueOf(360) : BigDecimal.valueOf(280);
                    BigDecimal platinum = isEvening ? BigDecimal.valueOf(540) : BigDecimal.valueOf(420);
                    showRepository.save(new Show(movie, screen, date, times[t], silver, gold, platinum));
                }
            }
        }
    }
}
