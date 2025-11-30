export default {
  data() {
    return {
      lots: [],
      newLot: {
        location_name: "",
        pin_code: "",
        price: "",
        number_of_spots: ""
      },
      editLot: null,
      message: "",
      showModal: false,
      showEditModal: false,
      selectedSpot: null,
      selectedSpotDetails: null,
      isOccupied: false,
      selectedSpotModal: false,
      showUsers: false,
      users: []
    };
  },

  methods: {
    async fetchLots() {
      try {
        const res = await fetch("/api/lot", {
          headers: { "Authentication-Token": localStorage.getItem("auth_token") }
        });
        const apiData = await res.json();
        this.lots = apiData.map(lot => ({
          id: lot.id,
          location_name: lot.place_label, 
          pin_code: lot.zipcode, 
          price: lot.hourly_rate, 
          number_of_spots: lot.total_slots,
          occupied_spots: lot.occupied_slots,
          spots: lot.slots.map(spot => ({
            number: spot.number,
            status: spot.status,
            lotId: spot.facilityId
          }))
        }));
      } catch (err) {
        console.error("Failed to fetch lots", err);
      }
    },

    async createLot() {
      try {
        const res = await fetch("/api/lot", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authentication-Token": localStorage.getItem("auth_token")
          },
          body: JSON.stringify({
            place_label: this.newLot.location_name,
            zipcode: this.newLot.pin_code,
            hourly_rate: parseFloat(this.newLot.price),
            total_slots: parseInt(this.newLot.number_of_spots)
          })
        });
        const data = await res.json();
        this.message = data.message;
        this.fetchLots();
        this.showModal = false;
        this.newLot = {
          location_name: "",
          pin_code: "",
          price: "",
          number_of_spots: ""
        };
      } catch (err) {
        console.error("Failed to create lot", err);
      }
    },

    async deleteLot(id) {
      if (!confirm("Delete this parking lot?")) return;
      try {
        const res = await fetch(`/api/lot/${id}`, {
          method: "DELETE",
          headers: { "Authentication-Token": localStorage.getItem("auth_token") }
        });
        const data = await res.json();
        this.message = data.message;
        this.fetchLots();
      } catch (err) {
        console.error("Failed to delete lot", err);
      }
    },

    openEditModal(lot) {
      this.editLot = { ...lot };
      this.showEditModal = true;
    },

    async updateLot() {
      try {
        const res = await fetch(`/api/lot/${this.editLot.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authentication-Token": localStorage.getItem("auth_token")
          },
          body: JSON.stringify({
            place_label: this.editLot.location_name,
            zipcode: this.editLot.pin_code,
            hourly_rate: parseFloat(this.editLot.price),
            total_slots: parseInt(this.editLot.number_of_spots)
          })
        });
        const data = await res.json();
        this.message = data.message;
        this.showEditModal = false;
        this.fetchLots();
      } catch (err) {
        console.error("Failed to update lot", err);
      }
    },

    generateSpots(lot) {
      return lot.spots || [];
    },

    handleSpotClick(spot) {
        this.selectedSpot = spot;
        this.isOccupied = spot.status === 'O';
        if (this.isOccupied) {
            this.fetchSpotDetails(spot);
        } else {
            this.selectedSpotDetails = null;
            this.selectedSpotModal = true;
        }
        },

    async fetchSpotDetails(spot) {
        try {
            const res = await fetch(`/api/spot/${spot.lotId}/${spot.number}`, {
            headers: { "Authentication-Token": localStorage.getItem("auth_token") }
            });
            this.selectedSpotDetails = await res.json();
            this.selectedSpotModal = true;
        } catch (err) {
            console.error("Failed to fetch spot details", err);
        }
    },

    async deleteSpot() {
      if (!confirm("Delete this available spot?")) return;
        try {
            const res = await fetch(`/api/spot/${this.selectedSpot.lotId}/${this.selectedSpot.number}`, {
            method: "DELETE",
            headers: { "Authentication-Token": localStorage.getItem("auth_token") }
            });
            const data = await res.json();
            this.message = data.message;
            this.selectedSpotModal = false;
            this.fetchLots();
        } catch (err) {
            console.error("Failed to delete spot", err);
        }
    },

    async fetchUsers() {
        try {
            const res = await fetch("/api/users", {
            headers: { "Authentication-Token": localStorage.getItem("auth_token") }
            });
            this.users = await res.json();
            this.showUsers = true;
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    },

    csvExport() {
      const token = localStorage.getItem("auth_token");
      fetch('/api/export', {
        headers: { "Authentication-Token": token }
      })
        .then(response => response.json())
        .then(data => {
          const taskId = data.job_id; 
          if (!taskId) {
              alert("Error: Failed to start export task. Check Celery worker.");
              return;
          }
          const interval = setInterval(() => {
            fetch(`/api/csv_result/${taskId}`, {
              headers: { "Authentication-Token": token }
            })
              .then(async res => {
                if (res.status === 202) {
                  console.log("⏳ Still generating...");
                  return;
                } else if (res.status === 200) {
                  clearInterval(interval);
                  return res.blob();
                } else {
                  const err = await res.json();
                  clearInterval(interval);
                  alert("Error: " + (err.message || "Failed to generate CSV."));
                }
              })
              .then(blob => {
                if (!blob) return;
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "reservations.csv";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              })
              .catch(err => {
                clearInterval(interval);
                console.error("CSV Error:", err);
                alert("Download failed. Please try again.");
              });
          }, 2000);
        })
        .catch(err => {
          console.error("Export Task Failed:", err);
          alert("CSV Export Task failed.");
        });
    }
  },

  mounted() {
    this.fetchLots();
  },

  template: `
    <div class="container mt-4">
    <div style="height: 610px; overflow-y: scroll;">
      <div v-if="message" class="alert alert-info">{{ message }}</div>
      <div class="text-end mb-3">
        <button @click="csvExport" class="btn btn-success">
          Download Reservations CSV
        </button>
      </div>

      <div class="row">
        <div class="col-md-4 mb-4" v-for="lot in lots" :key="lot.id">
          <div class="card shadow">
            <div class="card-header bg-primary text-white">
              Parking Lot_{{ lot.id }} - {{ lot.location_name }}
            </div>
            <div class="card-body">
              <p><strong>PIN:</strong> {{ lot.pin_code }}</p>
              <p><strong>Price:</strong> ₹{{ lot.price }}</p>
              <p><strong>Total Spots:</strong> {{ lot.number_of_spots }}</p>
              <div class="d-flex flex-wrap">
              <span
              v-for="(spot, index) in generateSpots(lot)"
              :key="index"
              class="badge me-1 mb-1"
              :class="spot.status === 'A' ? 'bg-success' : 'bg-danger'"
              style="cursor:pointer"
              @click="handleSpotClick(spot)"
              >
              {{ spot.status }}
              </span>
              </div>
              <div class="mt-3 text-end">
                <button class="btn btn-sm btn-warning me-2" @click="openEditModal(lot)">Edit</button>
                <button class="btn btn-sm btn-danger" @click="deleteLot(lot.id)">Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showModal" class="modal d-block" style="background:rgba(0,0,0,.6);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">New Parking Lot</h5>
              <button type="button" class="btn-close" @click="showModal=false"></button>
            </div>
            <div class="modal-body">
              <form @submit.prevent="createLot">
                <input v-model="newLot.location_name" class="form-control mb-2" placeholder="Location Name" required>
                <input v-model="newLot.pin_code" class="form-control mb-2" placeholder="PIN Code" required>
                <input v-model="newLot.price" type="number" step="0.01" class="form-control mb-2" placeholder="Price" required>
                <input v-model="newLot.number_of_spots" type="number" class="form-control mb-2" placeholder="Total Spots" required>
                <div class="text-end">
                  <button type="button" class="btn btn-secondary me-2" @click="showModal=false">Cancel</button>
                  <button type="submit" class="btn btn-primary">Create</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showEditModal" class="modal d-block" style="background:rgba(0,0,0,.6);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit Parking Lot</h5>
              <button type="button" class="btn-close" @click="showEditModal=false"></button>
            </div>
            <div class="modal-body">
              <form @submit.prevent="updateLot">
                <input v-model="editLot.location_name" class="form-control mb-2" placeholder="Location Name" required>
                <input v-model="editLot.pin_code" class="form-control mb-2" placeholder="PIN Code" required>
                <input v-model="editLot.price" type="number" step="0.01" class="form-control mb-2" placeholder="Price" required>
                <input v-model="editLot.number_of_spots" type="number" class="form-control mb-2" placeholder="Total Spots" required>
                <div class="text-end">
                  <button type="button" class="btn btn-secondary me-2" @click="showEditModal=false">Cancel</button>
                  <button type="submit" class="btn btn-warning">Update</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedSpotModal" class="modal d-block" style="background: rgba(0, 0, 0, 0.6);">
      <div class="modal-dialog">
          <div class="modal-content">
          <div class="modal-header">
              <h5 class="modal-title">Spot #{{ selectedSpot?.number }}</h5>
              <button type="button" class="btn-close" @click="selectedSpotModal = false"></button>
          </div>
          <div class="modal-body">
              <div v-if="isOccupied && selectedSpotDetails">
              <p><strong>Customer ID:</strong> {{ selectedSpotDetails.customer_id }}</p>
              <p><strong>Vehicle Number:</strong> {{ selectedSpotDetails.vehicle_number }}</p>
              <p><strong>Date:</strong> {{ selectedSpotDetails.date }}</p>
              <p><strong>Time:</strong> {{ selectedSpotDetails.time }}</p>
              <p><strong>Cost:</strong> ₹{{ selectedSpotDetails.cost }}</p>
              <div class="text-end">
                  <button class="btn btn-secondary" @click="selectedSpotModal = false">Close</button>
              </div>
              </div>
              <div v-else>
              <p><strong>Status:</strong> Available</p>
              <p><strong>Spot ID:</strong> {{ selectedSpot?.number }}</p>
              <div class="text-end">
                  <button class="btn btn-danger me-2" @click="deleteSpot">Delete</button>
                  <button class="btn btn-secondary" @click="selectedSpotModal = false">Cancel</button>
              </div>
              </div>
          </div>
          </div>
      </div>
      </div>

      <div v-if="showUsers" class="card mt-4">
          <div class="card-header bg-secondary text-white">
              <h5 class="mb-0">Registered Users</h5>
          </div>
          <div class="card-body">
              <table class="table table-striped">
              <thead>
                  <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  </tr>
              </thead>
              <tbody>
                  <tr v-for="user in users" :key="user.id">
                  <td>{{ user.id }}</td>
                  <td>{{ user.username }}</td>
                  <td>{{ user.email }}</td>
                  <td>{{ user.roles.join(', ') }}</td>
                  </tr>
              </tbody>
              </table>
              <div class="text-end">
              <button class="btn btn-secondary" @click="showUsers = false">Close</button>
              </div>
          </div>
      </div>

      <div class="text-center mt-4">
        <button class="btn btn-success px-4" @click="showModal = true">
          Add Parking Lot
        </button>
      </div>

    </div>
    </div>
  `
};