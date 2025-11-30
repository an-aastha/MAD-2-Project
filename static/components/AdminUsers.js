export default {
  template: `
    <div class="container mt-4" style="height: 610px; overflow-y: auto;">
      <h3 class="text-primary text-center mb-4">👥 Registered Accounts & Booking Records</h3>

      <div v-for="acc in accounts" :key="acc.id" class="card mb-3 shadow-sm border-0">
        <div class="card-body">
          <h5 class="card-title fw-bold">
            ID: {{ acc.id }} | Name: {{ acc.username }}
          </h5>
          <p class="text-muted mb-2"><strong>Email:</strong> {{ acc.email }}</p>

          <div v-if="acc.bookings && acc.bookings.length > 0">
            <table class="table table-hover table-bordered mt-3">
              <thead class="table-light">
                <tr>
                  <th>Facility</th>
                  <th>Vehicle</th>
                  <th>Slot</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bk in acc.bookings" :key="bk.start + bk.vehicle">
                  <td>{{ bk.facility }}</td>
                  <td>{{ bk.vehicle }}</td>
                  <td>{{ bk.slot }}</td>
                  <td>{{ bk.start }}</td>
                  <td>
                    <span v-if="bk.end">{{ bk.end }}</span>
                    <span v-else class="text-muted">Active</span>
                  </td>
                  <td>
                    <span v-if="bk.charged && bk.charged > 0">₹{{ bk.charged }}</span>
                    <span v-else class="text-warning">Pending</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="text-muted fst-italic">No bookings found for this account.</div>
        </div>
      </div>

      <div v-if="!accounts.length" class="text-center mt-5 text-muted">
        <p>No registered accounts to display yet.</p>
      </div>
    </div>
  `,

  data() {
    return {
      accounts: []
    };
  },

  methods: {
    async fetchAccounts() {
      try {
        const res = await fetch("/admin/accounts", {
          headers: {
            "Authentication-Token": localStorage.getItem("auth_token")
          }
        });

        if (!res.ok) {
          throw new Error("Failed to load accounts");
        }

        this.accounts = await res.json();
      } catch (err) {
        console.error("Error fetching accounts:", err);
        alert("Unable to load account records.");
      }
    }
  },

  mounted() {
    this.fetchAccounts();
  }
};
