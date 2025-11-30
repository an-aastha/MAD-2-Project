export default {
  template: `
    <div class="d-flex justify-content-center align-items-center border" style="height: 620px;">
      <div class="card shadow-lg border-0" style="width: 340px;">
        <div class="card-body">
          <h3 class="text-center text-primary mb-3">Account Login</h3>
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
            <button class="btn btn-primary fw-semibold" @click="attemptLogin">
              Sign In
            </button>
          </div>

          <div class="text-center mt-3">
            <small class="text-muted">
              Don’t have an account?
              <router-link to="/register">Register</router-link>
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
        password: ""
      },
      message: ""
    };
  },

  methods: {
    async attemptLogin() {
      try {
        const res = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.formData)
        });

        const data = await res.json();

        if (res.ok && data.auth_token) {
          localStorage.setItem("auth_token", data.auth_token);
          localStorage.setItem("id", data.id);
          localStorage.setItem("username", data.username);
          localStorage.setItem("roles", JSON.stringify(data.roles));

          // Update Navbar immediately
          eventBus.$emit("login-updated");

          // Navigate based on role
          if (data.roles.includes("admin")) {
            this.$router.push("/admin");
          } else {
            this.$router.push("/member");
          }
        } else {
          this.message = data.message || "Invalid credentials. Please try again.";
        }
      } catch (err) {
        console.error("Login error:", err);
        this.message = "Server error. Please try again later.";
      }
    }
  }
};
