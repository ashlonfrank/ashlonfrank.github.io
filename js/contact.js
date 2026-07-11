import { linkedInIconSvg, initNavBrand } from "./site-nav.js";
import { initFooter } from "./footer.js";

async function initContact() {
  const emailEl = document.getElementById("contact-email");
  const linkedInEl = document.getElementById("contact-linkedin");
  if (!emailEl) return;

  try {
    const response = await fetch("./data/projects.json");
    const data = await response.json();
    const { email, linkedin } = data.site || {};

    initFooter(data);
    initNavBrand(data.site);

    if (email) {
      emailEl.href = `mailto:${email}`;
      emailEl.textContent = email;
    }

    if (linkedInEl && linkedin) {
      linkedInEl.href = linkedin;
      linkedInEl.innerHTML = linkedInIconSvg();
    } else if (linkedInEl) {
      linkedInEl.hidden = true;
    }
  } catch {
    emailEl.textContent = "Email unavailable";
  }
}

initContact();
