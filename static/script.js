// Global Event Bus
window.eventBus = new Vue();

// ---------- Component Imports ----------
import Home from './components/Home.js';
import Login from './components/Login.js';
import Register from './components/Register.js';
import Navbar from './components/Navbar.js';
import Footer from './components/Footer.js';
import Member from './components/User.js';
import MemberSummary from './components/UserSummary.js';
import AdminPanel from './components/Admin.js';
import AdminAccounts from './components/AdminUsers.js';
import AdminReports from './components/AdminSummary.js';

// ---------- Route Configuration ----------
const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/register', component: Register },

  // Member (User) Section
  { path: '/member', component: Member },
  { path: '/member-summary', component: MemberSummary },

  // Admin Section
  { path: '/admin', component: AdminPanel },
  { path: '/admin-accounts', component: AdminAccounts },
  { path: '/admin-summary', component: AdminReports },

  // Redirect unknown routes to home
  { path: '*', redirect: '/' }
];

const router = new VueRouter({ routes });

// ---------- Vue App Initialization ----------
const app = new Vue({
  el: '#app',
  router,
  template: `
    <div>
      <nav-bar></nav-bar>
      <main class="container-fluid py-3">
        <router-view></router-view>
      </main>
      <app-footer></app-footer>
    </div>
  `,
  components: {
    'nav-bar': Navbar,
    'app-footer': Footer
  },
  data: {
    appTitle: 'ParkFlow Facility Manager'
  }
});
