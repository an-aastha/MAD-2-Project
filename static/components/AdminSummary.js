export default {
  template: `
    <div class="container mt-4" style="max-width: 1000px; height: 610px; overflow-y: scroll;">
      <h3 class="text-center text-primary">📈 Facility Dashboard Overview</h3>

      <!-- Summary Cards -->
      <div class="row mt-4">
        <div class="col-md-3" v-if="summary">
          <div class="card text-white bg-success mb-3 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Registered Accounts</h5>
              <p class="card-text fs-4">{{ summary.total_users }}</p>
            </div>
          </div>
        </div>

        <div class="col-md-3" v-if="summary">
          <div class="card text-white bg-info mb-3 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Total Facilities</h5>
              <p class="card-text fs-4">{{ summary.total_lots }}</p>
            </div>
          </div>
        </div>

        <div class="col-md-3" v-if="summary">
          <div class="card text-white bg-secondary mb-3 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Total Slots</h5>
              <p class="card-text fs-4">{{ summary.total_spots }}</p>
            </div>
          </div>
        </div>

        <div class="col-md-3" v-if="summary">
          <div class="card text-white bg-warning mb-3 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Total Revenue</h5>
              <p class="card-text fs-4">₹{{ summary.total_revenue }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="container mt-4" style="max-width: 850px;">
        <h5 class="text-center text-secondary mb-3">Facility Occupancy Overview</h5>
        <canvas id="facilityUsageChart" height="100"></canvas>
      </div>

      <div class="container mt-4" style="max-width: 850px;">
        <h5 class="text-center text-secondary mb-3">Revenue by Facility</h5>
        <canvas id="facilityRevenueChart" height="100"></canvas>
      </div>

      <div class="text-center mt-4" v-if="!summary">
        <p class="text-muted">Fetching dashboard data...</p>
      </div>
    </div>
  `,

  data() {
    return {
      summary: null,
      facilityStats: [],
      revenueData: []
    };
  },

  async mounted() {
    try {
      const headers = { "Authentication-Token": localStorage.getItem("auth_token") };
      const summaryRes = await fetch("/admin/summary", { headers }); 
      const summaryData = await summaryRes.json();
      this.summary = summaryData; 
      const usageRes = await fetch("/api/admin/lot-stats", { headers }); 
      const usageData = await usageRes.json();
      
      this.facilityStats = usageData.map(stat => ({
          facility: stat.location_name,    
          occupied: stat.occupied_spots,  
          available: stat.available_spots  
      }));
      const revenueRes = await fetch("/api/admin/revenue-per-lot", { headers }); 
      const revData = await revenueRes.json();
      
      this.revenueData = revData.map(item => ({
          location_name: item.location_name, 
          revenue: item.revenue               
      }));
      this.$nextTick(() => {
        if (this.facilityStats.length > 0) {
              this.renderUsageChart();
          }
          if (this.revenueData.length > 0) {
              this.renderRevenueChart();
          }
      });
    } catch (err) {
      console.error("Dashboard data load failed:", err);
    }
  },

  methods: {
    renderUsageChart() {
      const labels = this.facilityStats.map(f => f.facility);
      const occupiedData = this.facilityStats.map(f => f.occupied);
      const availableData = this.facilityStats.map(f => f.available);
      const ctx = document.getElementById("facilityUsageChart").getContext("2d");
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Occupied Slots",
              backgroundColor: "rgba(255, 99, 132, 0.7)",
              data: occupiedData
            },
            {
              label: "Available Slots",
              backgroundColor: "rgba(75, 192, 192, 0.7)",
              data: availableData
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top"
            }
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }
      });
    },

    renderRevenueChart() {
      const labels = this.revenueData.map(r => r.location_name);
      const values = this.revenueData.map(r => r.revenue);
      const ctx = document.getElementById("facilityRevenueChart").getContext("2d");
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Revenue (₹)",
              backgroundColor: "rgba(54, 162, 235, 0.7)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
              data: values
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top"
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
    }
  }
};
