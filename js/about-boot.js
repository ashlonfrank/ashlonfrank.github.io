import Lenis from "./vendor/lenis.mjs";
import { initNavBrand } from "./site-nav.js";
import { bindCopyEmail } from "./copy-email.js";
import { initFooter } from "./footer.js";
import { initPageAnalytics } from "./analytics.js";

const MOBILE_MQ = "(max-width: 900px)";

/** ~3 deliberate wheel gestures to read the full page; can still scroll through with persistence. */
const ABOUT_SCROLL = {
  lerp: 0.07,
  wheelMultiplier: 0.4,
  touchMultiplier: 0.52,
};

function initAboutSmoothScroll(onScroll) {
  document.documentElement.classList.add("lenis", "lenis-smooth");

  const lenis = new Lenis({
    lerp: ABOUT_SCROLL.lerp,
    smoothWheel: true,
    syncTouch: window.matchMedia(MOBILE_MQ).matches,
    wheelMultiplier: ABOUT_SCROLL.wheelMultiplier,
    touchMultiplier: ABOUT_SCROLL.touchMultiplier,
  });

  lenis.on("scroll", onScroll);

  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };

  requestAnimationFrame(raf);
  return lenis;
}

function readCssPx(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function initAboutContact(data) {
  const { email, linkedin, location } = data.site || {};
  const emailEl = document.getElementById("about-email");
  const copyBtn = document.getElementById("about-copy");
  const linkedInEl = document.getElementById("about-linkedin");
  const locationEl = document.getElementById("about-location");

  if (emailEl && email) {
    emailEl.href = `mailto:${email}`;
    emailEl.textContent = email;
    bindCopyEmail(copyBtn, email);
  } else if (emailEl) {
    emailEl.textContent = "Email unavailable";
    if (copyBtn) copyBtn.hidden = true;
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

/**
 * Mobile only:
 * - start: contact under nav (same band as Contact "Reach out!")
 * - mid/end: gone the moment #about-lead ("I'm Ashlon.") reaches that band
 * - page end: standard site footer in document flow (not this stack)
 *
 * Hide threshold uses CSS vars + cached height — never the contact's live
 * rect (display:none zeroes it).
 */
function initAboutContactScroll() {
  const contact = document.querySelector(".about__contact");
  const lead = document.getElementById("about-lead");
  if (!contact || !lead) return;

  const mq = window.matchMedia(MOBILE_MQ);
  let frame = 0;
  let measuredHeight = 0;
  let mode = "";

  const refreshHeight = () => {
    if (contact.classList.contains("is-covered")) return;
    const h = contact.offsetHeight;
    if (h > 0) measuredHeight = h;
  };

  const topBandBottom = () => {
    const sticky = readCssPx("--sticky-top", 40);
    const gap = readCssPx("--header-text-gap", 16);
    if (!measuredHeight) refreshHeight();
    return sticky + gap + (measuredHeight || 50);
  };

  const setMode = (next) => {
    if (next === mode) return;
    mode = next;
    contact.dataset.mode = next;
    contact.classList.toggle("is-covered", next === "hidden");
    contact.setAttribute("aria-hidden", next === "hidden" ? "true" : "false");
    try {
      contact.inert = next === "hidden";
    } catch {
      /* older browsers */
    }
  };

  const update = () => {
    if (!mq.matches) {
      setMode("top");
      return;
    }

    const bandBottom = topBandBottom();
    const leadTop = lead.getBoundingClientRect().top;
    const leadHitsBand = leadTop <= bandBottom;

    setMode(leadHitsBand ? "hidden" : "top");
  };

  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  const onMqChange = () => {
    if (!mq.matches) {
      contact.classList.remove("is-covered");
      mode = "";
    }
    refreshHeight();
    update();
  };

  window.addEventListener("resize", onScroll, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onScroll, { passive: true });
  }
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onMqChange);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(onMqChange);
  }

  refreshHeight();
  update();

  return {
    onScroll,
    refresh: () => {
      const wasCovered = contact.classList.contains("is-covered");
      if (wasCovered) {
        contact.classList.remove("is-covered");
        mode = "";
      }
      refreshHeight();
      update();
    },
  };
}

async function boot() {
  initPageAnalytics({ page: "about" });
  const contactScroll = initAboutContactScroll();

  try {
    initAboutSmoothScroll(contactScroll.onScroll);
  } catch (error) {
    console.warn("About smooth scroll unavailable:", error);
    window.addEventListener("scroll", contactScroll.onScroll, { passive: true });
  }

  try {
    const response = await fetch("./data/projects.json");
    const data = await response.json();
    initAboutContact(data);
    initNavBrand(data.site);
    initFooter(data);
  } catch {
    const emailEl = document.getElementById("about-email");
    const copyBtn = document.getElementById("about-copy");
    if (emailEl) emailEl.textContent = "Email unavailable";
    if (copyBtn) copyBtn.hidden = true;
  }

  contactScroll.refresh();
}

boot();
