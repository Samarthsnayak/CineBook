package com.cinebook.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(
    name = "seats",
    uniqueConstraints = @UniqueConstraint(name = "uk_screen_seat", columnNames = {"screen_id", "seat_number"})
)
public class Seat {

    public enum SeatCategory {
        SILVER, GOLD, PLATINUM
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "screen_id", nullable = false)
    private Screen screen;

    @Column(name = "seat_number", nullable = false, length = 10)
    private String seatNumber;

    @Column(name = "row_label", nullable = false, length = 4)
    private String rowLabel;

    @Column(name = "seat_col", nullable = false)
    private Integer seatCol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SeatCategory category;

    public Seat() {}

    public Seat(Screen screen, String seatNumber, String rowLabel, Integer seatCol, SeatCategory category) {
        this.screen = screen;
        this.seatNumber = seatNumber;
        this.rowLabel = rowLabel;
        this.seatCol = seatCol;
        this.category = category;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Screen getScreen() { return screen; }
    public void setScreen(Screen screen) { this.screen = screen; }
    public String getSeatNumber() { return seatNumber; }
    public void setSeatNumber(String seatNumber) { this.seatNumber = seatNumber; }
    public String getRowLabel() { return rowLabel; }
    public void setRowLabel(String rowLabel) { this.rowLabel = rowLabel; }
    public Integer getSeatCol() { return seatCol; }
    public void setSeatCol(Integer seatCol) { this.seatCol = seatCol; }
    public SeatCategory getCategory() { return category; }
    public void setCategory(SeatCategory category) { this.category = category; }
}
