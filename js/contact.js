import { initNavBrand } from "./site-nav.js";
import { initFooter } from "./footer.js";

async function initContact() {
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
