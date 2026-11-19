package com.cinebook.dto;

import com.cinebook.entity.Seat;
import java.math.BigDecimal;

public class SeatStatusDto {
    private Long id;
    private String seatNumber;
    private String rowLabel;
    private Integer seatCol;
    private Seat.SeatCategory category;
    private BigDecimal price;
    private boolean booked;

    public SeatStatusDto(Long id, String seatNumber, String rowLabel, Integer seatCol,
                         Seat.SeatCategory category, BigDecimal price, boolean booked) {
        this.id = id;
        this.seatNumber = seatNumber;
        this.rowLabel = rowLabel;
        this.seatCol = seatCol;
        this.category = category;
        this.price = price;
        this.booked = booked;
    }

    public Long getId() { return id; }
    public String getSeatNumber() { return seatNumber; }
    public String getRowLabel() { return rowLabel; }
    public Integer getSeatCol() { return seatCol; }
    public Seat.SeatCategory getCategory() { return category; }
    public BigDecimal getPrice() { return price; }
    public boolean isBooked() { return booked; }
}
