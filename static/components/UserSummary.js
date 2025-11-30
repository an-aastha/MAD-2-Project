export default {
  template: `
    <div class="container mt-4" style="max-width: 850px; height: 610px;">
      <h3 class="text-center text-primary mb-4">📈 My Booking Summary</h3>

      <div class="text-center mb-3">
        <p class="text-muted">Your recent booking activity across facilities</p>
      </div>

      <div class="bg-light border rounded shadow-sm p-3">
        <canvas id="usageChart" height="340"></canvas>
      </div>

      <div v-if="!bookings.length" class="text-center mt-4 text-muted">
        <p>No bookings recorded yet.</p>
      </div>
    </div>
  `,

  data() {
    return {
      bookings: [],
      chartInstance: null
    };
  },

  methods: {
    async fetchBookings() {
      try {
        const res = await fetch("/booking/history", {
          headers: {
            "Authentication-Token": localStorage.getItem("auth_token")
          }
        });

        const data = await res.json();
        this.bookings = data;
        const freq = this.computeFacilityFrequency(data);
        this.renderChart(freq);
      } catch (err) {
        console.error("Error fetching booking summary:", err);
      }
    },

    computeFacilityFrequency(data) {
      const freqMap = {};
      data.forEach(entry => {
        const facility = entry.facility || "Unknown";
        freqMap[facility] = (freqMap[facility] || 0) + 1;
      });
      return freqMap;
    },

    renderChart(freqMap) {
      const ctx = document.getElementById("usageChart").getContext("2d");
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }
      const labels = Object.keys(freqMap);
      const values = Object.values(freqMap);
      this.chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Total Bookings per Facility",
              data: values,
              backgroundColor: "rgba(54, 162, 235, 0.7)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            title: {
              display: true,
              text: "Booking Frequency by Facility",
              font: { size: 18 }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: "Facility Name",
                font: { size: 14 }
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Bookings",
                font: { size: 14 }
              },
              ticks: {
                precision: 0
              }
            }
          }
        }
      });
    }
  },

  mounted() {
    this.fetchBookings();
  }
};
