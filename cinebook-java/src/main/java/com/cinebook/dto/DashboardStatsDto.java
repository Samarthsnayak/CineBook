package com.cinebook.dto;

import java.math.BigDecimal;

public class DashboardStatsDto {
    private BigDecimal totalRevenue;
    private long confirmedBookings;
    private long cancelledBookings;
    private long totalMovies;
    private long totalTheatres;
    private long totalShows;
    private long totalUsers;

    public DashboardStatsDto(BigDecimal totalRevenue, long confirmedBookings, long cancelledBookings,
                             long totalMovies, long totalTheatres, long totalShows, long totalUsers) {
        this.totalRevenue = totalRevenue;
        this.confirmedBookings = confirmedBookings;
        this.cancelledBookings = cancelledBookings;
        this.totalMovies = totalMovies;
        this.totalTheatres = totalTheatres;
        this.totalShows = totalShows;
        this.totalUsers = totalUsers;
    }

    public BigDecimal getTotalRevenue() { return totalRevenue; }
    public long getConfirmedBookings() { return confirmedBookings; }
    public long getCancelledBookings() { return cancelledBookings; }
    public long getTotalMovies() { return totalMovies; }
    public long getTotalTheatres() { return totalTheatres; }
    public long getTotalShows() { return totalShows; }
    public long getTotalUsers() { return totalUsers; }
}
