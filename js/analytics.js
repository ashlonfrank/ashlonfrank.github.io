/**
 * Central Mixpanel tracker for the portfolio.
 * All mixpanel.track() calls stay in this file.
 */

import { MIXPANEL_TOKEN } from "./mixpanel-config.js";

const SDK_SRC = "/js/vendor/mixpanel-2-latest.min.js";
const FIRST_SCROLL_PX = 24;
const PROJECT_VISIBLE_RATIO = 0.2;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const EVENTS = {
  homepageVisit: "Homepage Visit",
  firstScroll: "First Scroll",
  projectReached: "Project Reached",
  projectImageOpened: "Project Image Opened",
  aboutClicked: "About Clicked",
  linkedInClicked: "LinkedIn Clicked",
  emailClicked: "Email Clicked",
  emailCopied: "Email Copied",
  visitDuration: "Visit Duration",
};

const queue = [];
const reachedProjects = new Set();

let bootPromise = null;
let client = null;
let homepageVisitSent = false;
let firstScrollSent = false;
let clicksBound = false;
let visitDurationBound = false;
let visitDurationSent = false;

function hasToken() {
  return Boolean(String(MIXPANEL_TOKEN || "").trim());
}

function sanitizeProps(props) {
  if (!props || typeof props !== "object") return {};

  const out = {};
  Object.entries(props).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (key.toLowerCase().includes("email")) return;
    if (typeof value === "string" && EMAIL_LIKE.test(value)) return;
    if (typeof value === "string" && /^mailto:/i.test(value)) return;
    out[key] = value;
  });
  return out;
}

function track(eventName, props, { urgent = false } = {}) {
  const payload = { eventName, props: sanitizeProps(props), urgent };
  if (!client) {
    queue.push(payload);
    return;
  }
  dispatch(payload);
}

function dispatch({ eventName, props, urgent }) {
  if (!client?.track) return;
  const options = urgent ? { send_immediately: true, transport: "sendBeacon" } : undefined;
  client.track(eventName, props, options);
}

function loadSdk() {
  return new Promise((resolve, reject) => {
    if (window.mixpanel?.init) {
      resolve(window.mixpanel);
      return;
    }

    const existing = document.querySelector(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.mixpanel), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(window.mixpanel), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

function bootAnalytics() {
  if (bootPromise) return bootPromise;
  if (!hasToken()) {
    bootPromise = Promise.resolve();
    return bootPromise;
  }

  bootPromise = (async () => {
    try {
      const mixpanel = await loadSdk();
      if (!mixpanel?.init) return;

      mixpanel.init(MIXPANEL_TOKEN.trim(), {
        autocapture: false,
        track_pageview: false,
        persistence: "localStorage",
        ip: false,
        ignore_dnt: false,
        record_sessions_percent: 0,
        batch_requests: true,
        debug: ["localhost", "127.0.0.1"].includes(window.location.hostname),
      });

      client = mixpanel;
      queue.splice(0).forEach(dispatch);
    } catch (error) {
      console.warn("Mixpanel unavailable:", error);
    }
  })();

  return bootPromise;
}

bootAnalytics();

function currentScrollY(getScrollY) {
  if (typeof getScrollY === "function") {
    const y = Number(getScrollY());
    if (Number.isFinite(y)) return y;
  }
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function bindFirstScroll({ getScrollY, onScroll } = {}) {
  const maybeTrack = () => {
    if (firstScrollSent) return;
    if (document.documentElement.classList.contains("is-calibrating")) return;
    if (currentScrollY(getScrollY) < FIRST_SCROLL_PX) return;

    firstScrollSent = true;
    track(EVENTS.firstScroll, {
      time_to_first_scroll_ms: Math.round(performance.now()),
    });
  };

  if (typeof onScroll === "function") {
    onScroll(maybeTrack);
  }
  window.addEventListener("scroll", maybeTrack, { passive: true });
  maybeTrack();
}

function getProjectProps(project) {
  const position = Number.parseInt(project?.dataset.projectIndex, 10);
  const name =
    project?.dataset.projectName ||
    project?.querySelector(".project__name")?.textContent?.trim() ||
    "Unknown";

  return {
    project_name: name,
    project_position: Number.isFinite(position) ? position : null,
  };
}

function observeProjectReached() {
  const projects = [...document.querySelectorAll("#projects .project")];
  if (!projects.length || typeof IntersectionObserver !== "function") return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.intersectionRatio < PROJECT_VISIBLE_RATIO) return;

        const project = entry.target;
        const key = project.dataset.projectId || project.dataset.projectIndex;
        if (!key || reachedProjects.has(key)) return;

        reachedProjects.add(key);
        track(EVENTS.projectReached, getProjectProps(project));
      });
    },
    { threshold: [PROJECT_VISIBLE_RATIO, 0.35, 0.5, 0.75] }
  );

  projects.forEach((project) => observer.observe(project));
}

function isAboutLink(node) {
  if (!(node instanceof HTMLAnchorElement)) return false;
  try {
    const url = new URL(node.href, window.location.origin);
    return url.pathname === "/about" || url.pathname === "/about/";
  } catch {
    return false;
  }
}

function bindClicks() {
  if (clicksBound) return;
  clicksBound = true;

  document.addEventListener("click", (event) => {
    const about = event.target.closest("a");
    if (about && isAboutLink(about)) {
      track(EVENTS.aboutClicked, null, { urgent: true });
      return;
    }

    if (event.target.closest("#footer-linkedin, #about-linkedin")) {
      track(EVENTS.linkedInClicked, null, { urgent: true });
      return;
    }

    if (event.target.closest("#footer-email, #about-email")) {
      track(EVENTS.emailClicked, null, { urgent: true });
    }
  });
}

function initVisitDuration() {
  if (visitDurationBound) return;
  visitDurationBound = true;

  let activeMs = 0;
  let sliceStart = document.visibilityState === "visible" ? performance.now() : null;

  const pause = () => {
    if (sliceStart == null) return;
    activeMs += Math.max(0, performance.now() - sliceStart);
    sliceStart = null;
  };

  const resume = () => {
    if (document.visibilityState === "visible" && sliceStart == null) {
      sliceStart = performance.now();
    }
  };

  const flush = () => {
    if (visitDurationSent) return;
    pause();
    visitDurationSent = true;
    track(
      EVENTS.visitDuration,
      { active_duration_ms: Math.round(activeMs) },
      { urgent: true }
    );
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
    else resume();
  });

  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
}

export async function initPageAnalytics({ page } = {}) {
  await bootAnalytics();
  if (page && client?.register) {
    client.register({ page });
  }
  bindClicks();
  initVisitDuration();
}

export async function initHomepageAnalytics(options = {}) {
  await initPageAnalytics({ page: "home" });

  if (!homepageVisitSent) {
    homepageVisitSent = true;
    track(EVENTS.homepageVisit);
  }

  bindFirstScroll(options);
  observeProjectReached();
}

export function trackProjectImageOpened(tile) {
  if (!tile) return;

  const project = tile.closest(".project");
  const imageIndex = Number.parseInt(tile.dataset.tileIndex, 10);
  const imageId = tile.dataset.imageId;
  const props = getProjectProps(project);

  if (Number.isFinite(imageIndex)) props.image_index = imageIndex;
  if (imageId) props.image_id = imageId;

  track(EVENTS.projectImageOpened, props);
}

export function trackEmailCopied() {
  track(EVENTS.emailCopied);
}
