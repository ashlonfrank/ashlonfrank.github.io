import { initNavBrand } from "./site-nav.js";
import { initFooter } from "./footer.js";
import { initPageAnalytics } from "./analytics.js";

async function initContact() {
  initPageAnalytics({ page: "contact" });
  try {
    const response = await fetch("./data/projects.json");
    const data = await response.json();
    initNavBrand(data.site);
    initFooter(data);
  } catch (error) {
    console.warn("Contact boot failed:", error);
  }
}

initContact();
