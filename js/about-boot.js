import { initNavBrand } from "./site-nav.js";

function initAboutContact(data) {
  const { email, linkedin, location } = data.site || {};
  const emailEl = document.getElementById("about-email");
  const linkedInEl = document.getElementById("about-linkedin");
  const locationEl = document.getElementById("about-location");

  if (emailEl && email) {
    emailEl.href = `mailto:${email}`;
    emailEl.textContent = email;
  } else if (emailEl) {
    emailEl.textContent = "Email unavailable";
  }

  if (linkedInEl && linkedin) {
    linkedInEl.href = linkedin;
  } else if (linkedInEl) {
    linkedInEl.hidden = true;
  }

  if (locationEl && location) {
    locationEl.textContent = location;
  } else if (locationEl) {
    locationEl.hidden = true;
  }
}

async function boot() {
  try {
    const response = await fetch("./data/projects.json");
    const data = await response.json();
    initAboutContact(data);
    initNavBrand(data.site);
  } catch {
    const emailEl = document.getElementById("about-email");
    if (emailEl) emailEl.textContent = "Email unavailable";
  }
}

boot();
