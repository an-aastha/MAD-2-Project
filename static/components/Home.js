export default {
  template: `
    <div class="d-flex align-items-center justify-content-center position-relative" style="height: 620px; border: 1px solid #dee2e6;">
      <!-- Background Image -->
      <img src="/static/images/facility_bg.jpg" 
           alt="Parking Facility" 
           class="position-absolute top-0 start-0 w-100 h-100" 
           style="object-fit: cover; filter: brightness(70%); z-index: 0;">
      
      <!-- Overlay Content -->
      <div class="text-center text-white position-relative" style="z-index: 1;">
        <h1 class="fw-bold display-5">Welcome to ParkFlow</h1>
        <p class="fs-5 mt-3">Efficient Facility & Slot Management System</p>
        <p class="mt-2 text-light">Streamline your parking experience with smart booking and monitoring tools.</p>
      </div>
    </div>
  `
};
