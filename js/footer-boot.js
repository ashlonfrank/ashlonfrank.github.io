import { initFooter } from "./footer.js";
import { initNavBrand } from "./site-nav.js";

async function boot() {
  if (!document.getElementById("footer-email")) return;

  try {
    const response = await fetch("./data/projects.json");
    const data = await response.json();
    initFooter(data);
    initNavBrand(data.site);
  } catch {
    const emailEl = document.getElementById("footer-email");
    if (emailEl) emailEl.textContent = "Email unavailable";
  }
}

boot();
