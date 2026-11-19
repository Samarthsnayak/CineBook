package com.cinebook.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public class ShowFormDto {
    @NotNull private Long movieId;
    @NotNull private Long screenId;
    @NotNull private LocalDate showDate;
    @NotNull private LocalTime showTime;
    @NotNull @DecimalMin("50.00") private BigDecimal silverPrice;
    @NotNull @DecimalMin("50.00") private BigDecimal goldPrice;
    @NotNull @DecimalMin("50.00") private BigDecimal platinumPrice;

    public Long getMovieId() { return movieId; }
    public void setMovieId(Long movieId) { this.movieId = movieId; }
    public Long getScreenId() { return screenId; }
    public void setScreenId(Long screenId) { this.screenId = screenId; }
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
