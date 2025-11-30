export default {
  template: `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary px-3 shadow-sm">
      <div class="container-fluid">
        <!-- Brand Name -->
        <router-link class="navbar-brand fw-bold fs-4" to="/">
          🚗 ParkFlow
        </router-link>

        <!-- Toggle button (for small screens) -->
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Nav Links -->
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto align-items-center">

            <li v-if="loggedIn" class="nav-item me-3 text-white">
              <small>👋 Welcome, <strong>{{ username }}</strong></small>
            </li>

            <!-- Admin Links -->
            <template v-if="loggedIn && isAdmin">
              <li class="nav-item">
                <router-link class="nav-link text-white" to="/admin">Dashboard</router-link>
              </li>
              <li class="nav-item">
                <router-link class="nav-link text-white" to="/admin-accounts">Accounts</router-link>
              </li>
              <li class="nav-item">
                <router-link class="nav-link text-white" to="/admin-summary">Reports</router-link>
              </li>
            </template>

            <!-- Member/User Links -->
            <template v-else-if="loggedIn && isMember">
              <li class="nav-item">
                <router-link class="nav-link text-white" to="/member">My Slots</router-link>
              </li>
              <li class="nav-item">
                <router-link class="nav-link text-white" to="/member-summary">Summary</router-link>
              </li>
            </template>

            <!-- Logout -->
            <li v-if="loggedIn" class="nav-item ms-2">
              <button class="btn btn-outline-light btn-sm" @click="logout">Logout</button>
            </li>

            <!-- Login/Register -->
            <template v-if="!loggedIn">
              <li class="nav-item">
                <router-link class="btn btn-light btn-sm me-2" to="/login">Login</router-link>
              </li>
              <li class="nav-item">
                <router-link class="btn btn-warning btn-sm" to="/register">Register</router-link>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </nav>
  `,

  data() {
    return {
      loggedIn: false,
      username: "",
      roles: []
    };
  },

  computed: {
    isAdmin() {
      return this.roles.includes("admin");
    },
    isMember() {
      return this.roles.includes("member") || this.roles.includes("user");
    }
  },

  methods: {
    updateAuthState() {
      this.loggedIn = !!localStorage.getItem("auth_token");
      this.username = localStorage.getItem("username") || "";
      this.roles = JSON.parse(localStorage.getItem("roles") || "[]");
    },

    logout() {
      localStorage.clear();
      this.updateAuthState();
      this.$router.push("/");
    }
  },

  created() {
    this.updateAuthState();
    this.$router.afterEach(() => {
      this.updateAuthState();
    });

    // Refresh when login event emitted
    eventBus.$on("login-updated", this.updateAuthState);
  }
};
