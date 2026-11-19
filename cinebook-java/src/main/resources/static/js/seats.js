// Interactive Seat Selection Controller for CineBook Thymeleaf View
document.addEventListener('DOMContentLoaded', () => {
    const selectedSeats = new Map();
    const maxSeats = 10;
    const seatButtons = document.querySelectorAll('.seat-btn[data-seat-id]');
    const seatListEl = document.getElementById('selected-seats-display');
    const totalEl = document.getElementById('selected-total-display');
    const countEl = document.getElementById('selected-count-display');
    const hiddenInputsContainer = document.getElementById('selected-seat-inputs');
    const proceedBtn = document.getElementById('proceed-summary-btn');

    function updateSummary() {
        const entries = Array.from(selectedSeats.values());
        let subtotal = 0;
        hiddenInputsContainer.innerHTML = '';

        entries.forEach((seat) => {
            subtotal += parseFloat(seat.price);
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'seatIds';
            input.value = seat.id;
            hiddenInputsContainer.appendChild(input);
        });

        seatListEl.textContent = entries.length > 0
            ? entries.map((s) => `${s.number} (${s.category})`).join(', ')
            : 'No seats selected yet';
        countEl.textContent = entries.length;
        totalEl.textContent = `₹${subtotal.toFixed(2)}`;
        proceedBtn.disabled = entries.length === 0;
    }

    seatButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const id = btn.dataset.seatId;
            const number = btn.dataset.seatNumber;
            const category = btn.dataset.seatCategory;
            const price = btn.dataset.seatPrice;

            if (selectedSeats.has(id)) {
                selectedSeats.delete(id);
                btn.classList.remove('selected');
            } else {
                if (selectedSeats.size >= maxSeats) {
                    alert('Maximum 10 seats can be booked in a single transaction.');
                    return;
                }
                selectedSeats.set(id, { id, number, category, price });
                btn.classList.add('selected');
            }
            updateSummary();
        });
    });

    updateSummary();
});
