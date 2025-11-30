export default {
  template: `
    <div class="d-flex justify-content-center align-items-center border" style="height: 620px;">
      <div class="card shadow-lg border-0" style="width: 360px;">
        <div class="card-body">
          <h3 class="text-center text-primary mb-3">Create New Account</h3>
          <p v-if="message" class="text-danger text-center">{{ message }}</p>

          <div class="mb-3">
            <label for="email" class="form-label fw-semibold">Email Address</label>
            <input
              v-model="formData.email"
              type="email"
              id="email"
              class="form-control"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="mb-3">
            <label for="username" class="form-label fw-semibold">Full Name</label>
            <input
              v-model="formData.username"
              type="text"
              id="username"
              class="form-control"
              placeholder="Enter your name"
              required
            />
          </div>

          <div class="mb-4">
            <label for="password" class="form-label fw-semibold">Password</label>
            <input
              v-model="formData.password"
              type="password"
              id="password"
              class="form-control"
              placeholder="••••••••"
              required
            />
          </div>

          <div class="d-grid">
            <button class="btn btn-success fw-semibold" @click="registerAccount">
              Register
            </button>
          </div>

          <div class="text-center mt-3">
            <small class="text-muted">
              Already have an account?
              <router-link to="/login">Login</router-link>
            </small>
          </div>
        </div>
      </div>
    </div>
  `,

  data() {
    return {
      formData: {
        email: "",
        username: "",
        password: ""
      },
      message: ""
    };
  },

  methods: {
    async registerAccount() {
      try {
        const response = await fetch("/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(this.formData)
        });

        const data = await response.json();

        if (response.ok && data.message) {
          alert("✅ Account created successfully!");
          this.$router.push("/login");
        } else {
          this.message = data.message || "Account creation failed. Try again.";
        }
      } catch (err) {
        console.error("Registration failed:", err);
        this.message = "Server error. Please try again later.";
      }
    }
  }
};
