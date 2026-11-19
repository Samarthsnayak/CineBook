package com.cinebook.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "shows")
public class Show {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "screen_id", nullable = false)
    private Screen screen;

    @Column(name = "show_date", nullable = false)
    private LocalDate showDate;

    @Column(name = "show_time", nullable = false)
    private LocalTime showTime;

    @Column(name = "silver_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal silverPrice;

    @Column(name = "gold_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal goldPrice;

    @Column(name = "platinum_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal platinumPrice;

    public Show() {}

    public Show(Movie movie, Screen screen, LocalDate showDate, LocalTime showTime,
                BigDecimal silverPrice, BigDecimal goldPrice, BigDecimal platinumPrice) {
        this.movie = movie;
        this.screen = screen;
        this.showDate = showDate;
        this.showTime = showTime;
        this.silverPrice = silverPrice;
        this.goldPrice = goldPrice;
        this.platinumPrice = platinumPrice;
    }

    public BigDecimal getPriceForCategory(Seat.SeatCategory category) {
        return switch (category) {
            case SILVER -> silverPrice;
            case GOLD -> goldPrice;
            case PLATINUM -> platinumPrice;
        };
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Movie getMovie() { return movie; }
    public void setMovie(Movie movie) { this.movie = movie; }
    public Screen getScreen() { return screen; }
    public void setScreen(Screen screen) { this.screen = screen; }
    public LocalDate getShowDate() { return showDate; }
    public void setShowDate(LocalDate showDate) { this.showDate = showDate; }
    public LocalTime getShowTime() { return showTime; }
    public void setShowTime(LocalTime showTime) { this.showTime = showTime; }
    public BigDecimal getSilverPrice() { return silverPrice; }
    public void setSilverPrice(BigDecimal silverPrice) { this.silverPrice = silverPrice; }
    public BigDecimal getGoldPrice() { return goldPrice; }
    public void setGoldPrice(BigDecimal goldPrice) { this.goldPrice = goldPrice; }
    public BigDecimal getPlatinumPrice() { return platinumPrice; }
    public void setPlatinumPrice(BigDecimal platinumPrice) { this.platinumPrice = platinumPrice; }
}
