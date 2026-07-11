/** Shared nav behavior — home link scrolls to top when already on index */
export function initNavBrand(site) {
  const brand = document.querySelector(".nav__brand");
  const role = document.querySelector(".nav__role");

  if (brand && site?.name) {
    brand.textContent = site.name;
  }

  if (role && site?.role) {
    role.textContent = site.role;
  }
}

export function initNavHome(lenis = null) {
  const homeLink = document.querySelector(".nav__brand");
  if (!homeLink) return;

  homeLink.addEventListener("click", (event) => {
    const path = window.location.pathname;
    const onHome =
      path.endsWith("/") ||
      path.endsWith("/index.html") ||
      path.endsWith("2026 Portfolio") ||
      path.endsWith("2026 Portfolio/");

    if (!onHome) return;

    event.preventDefault();
    if (lenis) {
      lenis.scrollTo(0, { duration: 0.48 });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

export function linkedInIconSvg() {
  return `<svg class="social-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.25"/>
    <path fill="currentColor" d="M4.5 6.75v4.25H3V6.75h1.5ZM3.75 5.25a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8ZM13 11h-1.5V9.1c0-.75-.27-1.26-.94-1.26-.51 0-.82.34-.95.67-.05.12-.06.29-.06.46V11H8.05V6.75h1.5v.67c.2-.31.56-.75 1.37-.75 1 0 1.75.65 1.75 2.05V11Z"/>
  </svg>`;
}
