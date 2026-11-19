package com.cinebook.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "booking_seats",
    uniqueConstraints = @UniqueConstraint(name = "uk_show_seat_lock", columnNames = {"show_id", "seat_id"})
)
public class BookingSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "show_id", nullable = false)
    private Show show;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seat seat;

    @Column(name = "seat_number", nullable = false, length = 10)
    private String seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Seat.SeatCategory category;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    public BookingSeat() {}

    public BookingSeat(Booking booking, Show show, Seat seat, BigDecimal price) {
        this.booking = booking;
        this.show = show;
        this.seat = seat;
        this.seatNumber = seat.getSeatNumber();
        this.category = seat.getCategory();
        this.price = price;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Booking getBooking() { return booking; }
    public void setBooking(Booking booking) { this.booking = booking; }
    public Show getShow() { return show; }
    public void setShow(Show show) { this.show = show; }
    public Seat getSeat() { return seat; }
    public void setSeat(Seat seat) { this.seat = seat; }
    public String getSeatNumber() { return seatNumber; }
    public void setSeatNumber(String seatNumber) { this.seatNumber = seatNumber; }
    public Seat.SeatCategory getCategory() { return category; }
    public void setCategory(Seat.SeatCategory category) { this.category = category; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
}
