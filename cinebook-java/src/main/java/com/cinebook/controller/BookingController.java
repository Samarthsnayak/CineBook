package com.cinebook.controller;

import com.cinebook.dto.CheckoutRequest;
import com.cinebook.dto.SeatStatusDto;
import com.cinebook.entity.Booking;
import com.cinebook.entity.Payment;
import com.cinebook.entity.Show;
import com.cinebook.entity.User;
import com.cinebook.service.BookingService;
import com.cinebook.service.QrCodeService;
import com.cinebook.service.ShowService;
import com.cinebook.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Controller
public class BookingController {

    private final ShowService showService;
    private final BookingService bookingService;
    private final UserService userService;
    private final QrCodeService qrCodeService;

    public BookingController(ShowService showService, BookingService bookingService,
                             UserService userService, QrCodeService qrCodeService) {
        this.showService = showService;
        this.bookingService = bookingService;
        this.userService = userService;
        this.qrCodeService = qrCodeService;
    }

    @GetMapping("/shows/{showId}/seats")
    public String seatSelection(@PathVariable Long showId, Model model) {
        Show show = showService.getById(showId);
        List<SeatStatusDto> seats = showService.getSeatLayoutForShow(showId);
        Map<String, List<SeatStatusDto>> seatsByRow = seats.stream()
                .collect(Collectors.groupingBy(SeatStatusDto::getRowLabel));

        model.addAttribute("show", show);
        model.addAttribute("seats", seats);
        model.addAttribute("seatsByRow", seatsByRow);
        return "seats";
    }

    @PostMapping("/bookings/summary")
    public String bookingSummary(@RequestParam Long showId,
                                 @RequestParam List<Long> seatIds,
                                 Model model,
                                 RedirectAttributes redirectAttributes) {
        if (seatIds == null || seatIds.isEmpty()) {
            redirectAttributes.addFlashAttribute("errorMessage", "Please select at least one seat.");
            return "redirect:/shows/" + showId + "/seats";
        }
        Show show = showService.getById(showId);
        List<SeatStatusDto> allSeats = showService.getSeatLayoutForShow(showId);
        List<SeatStatusDto> selected = allSeats.stream()
                .filter(s -> seatIds.contains(s.getId()) && !s.isBooked())
                .toList();

        if (selected.size() != seatIds.size()) {
            redirectAttributes.addFlashAttribute("errorMessage", "One or more selected seats are no longer available.");
            return "redirect:/shows/" + showId + "/seats";
        }

        BigDecimal subtotal = selected.stream().map(SeatStatusDto::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal fee = bookingService.calculateConvenienceFee(selected.size());
        BigDecimal tax = bookingService.calculateGstTax(fee);
        BigDecimal total = subtotal.add(fee).add(tax);

        model.addAttribute("show", show);
        model.addAttribute("selectedSeats", selected);
        model.addAttribute("seatIds", seatIds);
        model.addAttribute("subtotal", subtotal);
        model.addAttribute("convenienceFee", fee);
        model.addAttribute("taxAmount", tax);
        model.addAttribute("totalAmount", total);
        return "summary";
    }

    @PostMapping("/payment")
    public String paymentPage(@RequestParam Long showId,
                              @RequestParam List<Long> seatIds,
                              Model model) {
        Show show = showService.getById(showId);
        List<SeatStatusDto> selected = showService.getSeatLayoutForShow(showId).stream()
                .filter(s -> seatIds.contains(s.getId()))
                .toList();
        BigDecimal subtotal = selected.stream().map(SeatStatusDto::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal fee = bookingService.calculateConvenienceFee(selected.size());
        BigDecimal tax = bookingService.calculateGstTax(fee);

        model.addAttribute("show", show);
        model.addAttribute("selectedSeats", selected);
        model.addAttribute("seatIds", seatIds);
        model.addAttribute("subtotal", subtotal);
        model.addAttribute("convenienceFee", fee);
        model.addAttribute("taxAmount", tax);
        model.addAttribute("totalAmount", subtotal.add(fee).add(tax));
        model.addAttribute("idempotencyKey", java.util.UUID.randomUUID().toString());
        return "payment";
    }

    @PostMapping("/payment/process")
    public String processPayment(@RequestParam Long showId,
                                 @RequestParam List<Long> seatIds,
                                 @RequestParam Payment.PaymentMethod paymentMethod,
                                 @RequestParam(required = false) String paymentDetails,
                                 @RequestParam(required = false) String idempotencyKey,
                                 @RequestParam(defaultValue = "false") boolean simulateFailure,
                                 Authentication auth,
                                 RedirectAttributes redirectAttributes) {
        User user = userService.findByEmail(auth.getName());
        CheckoutRequest req = new CheckoutRequest();
        req.setShowId(showId);
        req.setSeatIds(seatIds);
        req.setPaymentMethod(paymentMethod);
        req.setPaymentDetails(paymentDetails);
        req.setIdempotencyKey(idempotencyKey);
        req.setSimulateFailure(simulateFailure);

        try {
            Booking booking = bookingService.completeBooking(user, req);
            redirectAttributes.addFlashAttribute("paymentSuccess", true);
            return "redirect:/bookings/ticket/" + booking.getBookingReference();
        } catch (Exception ex) {
            redirectAttributes.addFlashAttribute("errorMessage", ex.getMessage());
            return "redirect:/shows/" + showId + "/seats";
        }
    }

    @GetMapping("/bookings/ticket/{ref}")
    public String ticketConfirmation(@PathVariable String ref, Authentication auth, Model model) {
        User currentUser = userService.findByEmail(auth.getName());
        Booking booking = bookingService.getByReference(ref);
        boolean isAdmin = currentUser.getRole() == User.Role.ADMIN;
        if (!isAdmin && !booking.getUser().getId().equals(currentUser.getId())) {
            throw new SecurityException("You are not authorized to view this digital ticket.");
        }
        String seatList = !booking.getSeatSummary().isBlank()
                ? booking.getSeatSummary()
                : booking.getBookingSeats().stream()
                    .map(bs -> bs.getSeatNumber())
                    .collect(Collectors.joining(", "));
        String qrPayload = "CINEBOOK|" + booking.getBookingReference()
                + "|" + booking.getShow().getMovie().getTitle()
                + "|" + booking.getShow().getShowDate()
                + " " + booking.getShow().getShowTime()
                + "|SEATS:" + seatList;

        model.addAttribute("booking", booking);
        model.addAttribute("seatList", seatList);
        model.addAttribute("qrCodeImage", qrCodeService.generateQrCodeBase64(qrPayload, 220, 220));
        return "ticket";
    }

    @GetMapping("/bookings/my")
    public String myBookings(Authentication auth, Model model) {
        User user = userService.findByEmail(auth.getName());
        model.addAttribute("currentUser", user);
        model.addAttribute("bookings", bookingService.getUserBookings(user.getId()));
        return "my-bookings";
    }

    @PostMapping("/bookings/{id}/cancel")
    public String cancelBooking(@PathVariable Long id, Authentication auth, RedirectAttributes redirectAttributes) {
        User user = userService.findByEmail(auth.getName());
        try {
            bookingService.cancelBooking(id, user);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Booking cancelled successfully. Your seats have been released and refund initiated.");
        } catch (Exception ex) {
            redirectAttributes.addFlashAttribute("errorMessage", ex.getMessage());
        }
        return "redirect:/bookings/my";
    }
}
