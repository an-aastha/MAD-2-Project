export default {
  template: `
    <div class="container-fluid border" style="height: 630px;">
      <div class="row h-100">

        <!-- Available Facilities -->
        <div class="col-md-6 border-end" style="overflow-y: auto;">
          <h4 class="mt-3 text-primary fw-bold">Available Facilities</h4>
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Facility</th>
                <th>Free Slots</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="facility in facilities" :key="facility.id">
                <td>{{ facility.place_label }}</td>
                                <td>{{ (facility.total_slots || 0) - (facility.occupied || 0) }}</td> 
                <td class="text-end">
                  <button class="btn btn-success btn-sm" @click="openBookingForm(facility.id)">Reserve</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Active Bookings -->
        <div class="col-md-6" style="overflow-y: auto;">
          <h4 class="mt-3 text-success fw-bold">Your Active Bookings</h4>
          <ul class="list-group">
            <li v-for="booking in bookings" :key="booking.id" class="list-group-item shadow-sm mb-2 rounded">
              <div>
                <strong>Facility:</strong> {{ booking.facility }} <br>
                <strong>Slot:</strong> {{ booking.slot }} <br>
                <strong>Vehicle:</strong> {{ booking.vehicle }} <br>
                <strong>Start:</strong> {{ formatTime(booking.start) }} <br>
                <span v-if="booking.released">
                  <strong>End:</strong> {{ formatTime(booking.end) }} <br>
                </span>
                <strong>Status:</strong>
                <span :class="booking.released ? 'text-danger' : 'text-success'">
                  {{ booking.released ? 'Released' : 'Active' }}
                </span>
              </div>
              <div class="text-end" v-if="!booking.released">
                <button class="btn btn-danger btn-sm mt-2" @click="releaseBooking(booking.id)">Release</button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Reserve Modal -->
      <div v-if="showBookingModal" class="modal d-block" style="background: rgba(0,0,0,0.6);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Reserve a Slot</h5>
              <button class="btn-close" @click="cancelBooking()"></button>
            </div>
            <div class="modal-body">
              <p><strong>User ID:</strong> {{ userId }}</p>
              <p><strong>Facility ID:</strong> {{ selectedFacilityId }}</p>
              <p><strong>Slot:</strong> Auto-assigned</p>

              <input v-model="vehicleNumber" class="form-control mb-3" placeholder="Enter Vehicle Number" required>

              <div class="text-end">
                <button class="btn btn-secondary me-2" @click="cancelBooking()">Cancel</button>
                <button class="btn btn-primary" @click="confirmBooking()">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Release Confirmation Modal -->
      <div v-if="showReleaseModal" class="modal d-block" style="background: rgba(0,0,0,0.6);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Confirm Release</h5>
              <button class="btn-close" @click="cancelRelease()"></button>
            </div>
            <div class="modal-body">
              <p><strong>Vehicle:</strong> {{ releaseData.vehicle }}</p>
              <p><strong>Start Time:</strong> {{ releaseData.start }}</p>
              <p><strong>End Time:</strong> {{ releaseData.end }}</p>
              <p><strong>Total Charge:</strong> ₹{{ releaseData.cost }}</p>

              <div class="text-end">
                <button class="btn btn-secondary me-2" @click="cancelRelease()">Cancel</button>
                <button class="btn btn-danger" @click="confirmRelease()">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  data() {
    return {
      userId: localStorage.getItem("id"),
      username: localStorage.getItem("username") || "User",
      facilities: [],
      bookings: [],
      showBookingModal: false,
      selectedFacilityId: null,
      vehicleNumber: "",
      showReleaseModal: false,
      releaseData: {
        id: null,
        vehicle: "",
        start: "",
        end: "",
        cost: 0
      }
    };
  },

  methods: {
    async fetchFacilities() {
        try {
            const res = await fetch("/catalog/facility", { 
                headers: { "Authentication-Token": localStorage.getItem("auth_token") }
            });
            const apiData = await res.json();
            this.facilities = apiData.map(fac => ({
                id: fac.id,
                place_label: fac.place_label, 
                total_slots: fac.total_slots,
                occupied: fac.occupied_slots
            }));
        } catch (err) {
            console.error("Failed to load facilities:", err);
        }
    },

    async fetchBookings() {
        try {
            const res = await fetch("/booking/history", { 
                headers: { "Authentication-Token": localStorage.getItem("auth_token") }
            });
            if (res.headers.get("Content-Type").includes("text/html")) {
                 console.error("Authentication redirect detected. Received HTML, expected JSON.");
                 throw new Error("Authentication failed or route misconfigured.");
            }
            this.bookings = await res.json();
        } catch (err) {
            console.error("Failed to load bookings:", err);
        }
    },

    openBookingForm(facilityId) {
      this.selectedFacilityId = facilityId;
      this.vehicleNumber = "";
      this.showBookingModal = true;
    },

    cancelBooking() {
      this.showBookingModal = false;
      this.selectedFacilityId = null;
      this.vehicleNumber = "";
    },

    async confirmBooking() {
      try {
        const res = await fetch("/booking/reserve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authentication-Token": localStorage.getItem("auth_token")
          },
          body: JSON.stringify({
            facility_id: this.selectedFacilityId,
            vehicle_no: this.vehicleNumber
          })
        });

        const data = await res.json();
        alert(data.message || "Slot reserved!");
        this.fetchFacilities();
        this.fetchBookings();
        this.cancelBooking();
      } catch (err) {
        console.error("Booking failed:", err);
        alert("Something went wrong. Try again later.");
      }
    },

    releaseBooking(bookingId) {
      const booking = this.bookings.find(b => b.id === bookingId);
      if (!booking) return;

      const start = new Date(booking.start);
      const end = new Date();
      const hours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
      const hourlyRate = booking.rate || 25;
      const cost = hours * hourlyRate;

      this.releaseData = {
        id: booking.slot_id_to_release,
        vehicle: booking.vehicle,
        start: start.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        end: end.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        cost
      };

      this.showReleaseModal = true;
    },

    async confirmRelease() {
      try {
        const res = await fetch("/booking/release", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authentication-Token": localStorage.getItem("auth_token")
          },
          body: JSON.stringify({ slot_id: this.releaseData.id })
        });

        const data = await res.json();
        alert(data.message || "Slot released successfully!");
        this.fetchFacilities();
        this.fetchBookings();
        this.cancelRelease();
      } catch (err) {
        console.error("Release failed:", err);
        alert("Something went wrong while releasing.");
      }
    },

    cancelRelease() {
      this.showReleaseModal = false;
      this.releaseData = { id: null, vehicle: "", start: "", end: "", cost: 0 };
    },

    formatTime(utc) {
      if (!utc) return "N/A";
      const d = new Date(utc);
      return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
    }
  },

  mounted() {
    this.fetchFacilities();
    this.fetchBookings();
  }
};
