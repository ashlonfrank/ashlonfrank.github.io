/**
 * Portfolio framework — ryry.io-style sticky titles + tile lightbox
 */

import Lenis from "./vendor/lenis.mjs";
import { initNavHome, initNavBrand } from "./site-nav.js";
import { initFooter } from "./footer.js";

const landingSettleHandlers = new Set();

function notifyLandingSettle(targetY) {
  landingSettleHandlers.forEach((handler) => handler(targetY));
}

async function init() {
  beginCalibration();

  const main = document.getElementById("projects");
  if (!main) {
    endCalibration();
    return;
  }

  const response = await fetch("./data/projects.json");
  const data = await response.json();

  data.sections.forEach((section) => {
    main.appendChild(buildSection(section));
  });

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  measureSectionLayout();
  window.addEventListener("resize", scheduleMeasureSectionLayout);
  window.visualViewport?.addEventListener("resize", scheduleMeasureSectionLayout);

  initFooter(data);
  initNavBrand(data.site);

  const scroll = initSmoothScroll();
  initNavHome(scroll.lenis);
  initTileLightbox(scroll);
  initTileVideos();
  initProjectIndex(scroll);

  endCalibration(scroll);
}

function beginCalibration() {
  document.documentElement.classList.add("is-calibrating");
  window.scrollTo(0, 0);
}

function endCalibration(scroll) {
  window.scrollTo(0, 0);
  scroll?.lenis?.scrollTo(0, { immediate: true, force: true });
  document.documentElement.classList.remove("is-calibrating");
  window.dispatchEvent(new Event("scroll"));
}

function initSmoothScroll() {
  const scrollHandlers = new Set();
  const frameHandlers = new Set();
  let scrollScheduled = false;
  let lenis = null;
  const landingStep = createLandingStepController();

  const emitScroll = () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      scrollScheduled = false;
      scrollHandlers.forEach((handler) => handler());
    });
  };

  const emitFrame = () => {
    frameHandlers.forEach((handler) => handler());
  };

  const bind = (set, handler) => {
    set.add(handler);
    return () => set.delete(handler);
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener("scroll", emitScroll, { passive: true });
    const raf = () => {
      emitFrame();
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    return {
      onScroll: (handler) => bind(scrollHandlers, handler),
      onFrame: (handler) => bind(frameHandlers, handler),
      onLandingSettle: (handler) => {
        landingSettleHandlers.add(handler);
        return () => landingSettleHandlers.delete(handler);
      },
      lenis: null,
    };
  }

  try {
    document.documentElement.classList.add("lenis", "lenis-smooth");

    lenis = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
      virtualScroll: (data) => landingStep.onVirtualScroll(data),
    });

    landingStep.attach(lenis);
    lenis.on("scroll", emitScroll);

    const raf = (time) => {
      lenis.raf(time);
      landingStep.onFrame();
      emitFrame();
      requestAnimationFrame(raf);
    };

    requestAnimationFrame(raf);
  } catch (error) {
    console.warn("Smooth scroll unavailable:", error);
    window.addEventListener("scroll", emitScroll, { passive: true });
    const raf = () => {
      emitFrame();
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  return {
    onScroll: (handler) => bind(scrollHandlers, handler),
    onFrame: (handler) => bind(frameHandlers, handler),
    onLandingSettle: (handler) => {
      landingSettleHandlers.add(handler);
      return () => landingSettleHandlers.delete(handler);
    },
    lenis,
  };
}

function getSectionLandingYs() {
  return sectionLandingYs;
}

function findNextLanding(scrollY, direction) {
  const landings = getSectionLandingYs();
  if (!landings.length || !direction) return null;

  const onLanding = landings.find(
    (landing) => Math.abs(landing.y - scrollY) <= LANDING_STEP.landTolerance
  );

  if (onLanding) {
    const index = landings.indexOf(onLanding);
    if (direction > 0) return landings[index + 1] ?? null;
    return landings[index - 1] ?? null;
  }

  if (direction > 0) {
    return landings.find((landing) => landing.y > scrollY + LANDING_STEP.landTolerance) ?? null;
  }

  return (
    [...landings].reverse().find((landing) => landing.y < scrollY - LANDING_STEP.landTolerance) ?? null
  );
}

function createLandingStepController() {
  let lenis = null;
  let scrollSession = null;
  let settleUntil = 0;
  let isSettling = false;

  const blockWheel = (event) => {
    event?.preventDefault?.();
    return false;
  };

  const finishAtTarget = (targetY) => {
    scrollSession = null;
    isSettling = true;
    settleUntil = performance.now() + LANDING_STEP.settleCooldownMs;

    lenis.scrollTo(targetY, {
      duration: LANDING_STEP.snapDuration,
      easing: LANDING_STEP.easing,
      lock: true,
      programmatic: true,
      onComplete: () => {
        isSettling = false;
        notifyLandingSettle(targetY);
      },
    });
  };

  return {
    attach(instance) {
      lenis = instance;
    },

    onVirtualScroll({ deltaY, event }) {
      if (!lenis || !getSectionLandingYs().length) return;
      if (document.body.classList.contains("is-lightbox-open")) return;
      if (isSettling) return blockWheel(event);

      if (performance.now() < settleUntil) {
        return blockWheel(event);
      }

      const direction = Math.sign(deltaY);
      if (!direction) return;

      if (!scrollSession) {
        const target = findNextLanding(lenis.animatedScroll, direction);
        if (!target) return;
        scrollSession = { targetY: target.y, direction };
      } else if (direction !== scrollSession.direction) {
        scrollSession = null;
        const target = findNextLanding(lenis.animatedScroll, direction);
        if (!target) return blockWheel(event);
        scrollSession = { targetY: target.y, direction };
      }

      return;
    },

    onFrame() {
      if (!lenis || !scrollSession || isSettling) return;

      const { targetY, direction } = scrollSession;

      if (direction > 0 && lenis.targetScroll > targetY) {
        lenis.targetScroll = targetY;
      } else if (direction < 0 && lenis.targetScroll < targetY) {
        lenis.targetScroll = targetY;
      }

      const reached =
        direction > 0
          ? lenis.animatedScroll >= targetY - LANDING_STEP.landTolerance
          : lenis.animatedScroll <= targetY + LANDING_STEP.landTolerance;

      if (reached) {
        lenis.animate.stop();
        finishAtTarget(targetY);
      }
    },

    reset() {
      scrollSession = null;
      isSettling = false;
      settleUntil = 0;
    },
  };
}

function initProjectIndex(scroll) {
  const indexEl = document.getElementById("project-index");
  const projects = [...document.querySelectorAll(".project")];
  if (!indexEl || !projects.length) return;

  projects.forEach((project, i) => {
    project.dataset.projectIndex = String(i + 1).padStart(2, "0");
  });

  measureFixedIndexPosition(indexEl);
  const valueEl = getIndexValueEl(indexEl);
  ensureOdometer(valueEl);
  measureOdometerMetrics(indexEl);
  setOdometerValue(valueEl, projects[0].dataset.projectIndex, false);

  let activeIndex = 0;
  let lastScrollY = window.scrollY;

  const update = () => {
    const scrollingDown = window.scrollY >= lastScrollY;
    lastScrollY = window.scrollY;
    activeIndex = updateProjectIndexValue(indexEl, projects, activeIndex, scrollingDown);
  };

  update();
  measureIndexSlot(indexEl);

  const observer = new IntersectionObserver(
    () => update(),
    { threshold: [0, 0.25, 0.5, 0.75] }
  );

  projects.forEach((project) => observer.observe(project));
  scroll.onScroll(update);
  scroll.onLandingSettle?.(() => {
    activeIndex = updateProjectIndexValue(indexEl, projects, activeIndex, true);
  });
  scroll.onFrame(() => {
    if (!indexEl.classList.contains("is-visible")) return;
    const currentActive = projects.findIndex((project) =>
      project.classList.contains("is-index-active")
    );
    positionProjectIndex(indexEl, projects, currentActive >= 0 ? currentActive : activeIndex);

    const lenis = scroll.lenis;
    if (!lenis || Math.abs(lenis.velocity ?? 0) > 0.9) return;

    const nextIndex = getActiveProjectIndex(projects, activeIndex, true);
    if (
      nextIndex !== activeIndex &&
      nextIndex > activeIndex &&
      isSectionHeaderLanded(projects[nextIndex])
    ) {
      activeIndex = updateProjectIndexValue(indexEl, projects, activeIndex, true);
    }
  });
  window.addEventListener("resize", () => {
    measureFixedIndexPosition(indexEl);
    measureIndexSlot(indexEl);
    update();
  });
}

function getIndexValueEl(indexEl) {
  return indexEl.querySelector(".project-index__value") || indexEl;
}

function measureFixedIndexPosition(indexEl) {
  const topContent = document.querySelector(".project__top-content");
  const spacer = document.querySelector(".project__index-spacer");
  if (!topContent || !spacer) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const stickyTop = parseFloat(rootStyle.getPropertyValue("--sticky-top")) || 40;
  const textOffset =
    parseFloat(rootStyle.getPropertyValue("--header-text-offset")) ||
    parseFloat(getComputedStyle(topContent).paddingTop) ||
    0;

  document.documentElement.style.setProperty("--index-fixed-top", `${stickyTop + textOffset}px`);
  document.documentElement.style.setProperty(
    "--index-fixed-left",
    `${spacer.getBoundingClientRect().left}px`
  );
}

function measureIndexSlot(indexEl) {
  const valueEl = getIndexValueEl(indexEl);
  ensureOdometer(valueEl);
  measureOdometerMetrics(indexEl);
}

function measureOdometerMetrics(indexEl) {
  let probe = document.getElementById("index-digit-probe");
  if (!probe) {
    probe = document.createElement("span");
    probe.id = "index-digit-probe";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;letter-spacing:0;font-variant-numeric:normal;";
    document.body.appendChild(probe);
  }

  const style = getComputedStyle(indexEl);
  probe.style.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

  let maxW = 0;
  for (let d = 0; d <= 9; d += 1) {
    probe.textContent = String(d);
    maxW = Math.max(maxW, probe.getBoundingClientRect().width);
  }

  const digitW = Math.ceil(maxW);
  const tracking =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--text-title-tracking")) || 0;
  const fontSize = parseFloat(style.fontSize) || 64;
  const digitStep = Math.round(fontSize * 0.85 * 100) / 100;

  document.documentElement.style.setProperty("--index-digit-w", `${digitW}px`);
  document.documentElement.style.setProperty("--index-slot-w", `${digitW * 2 + tracking}px`);
  document.documentElement.style.setProperty("--index-digit-step", `${digitStep}px`);
  indexEl.style.setProperty("--index-odometer-ms", `${INDEX_ODOMETER_MS}ms`);
}

function ensureOdometer(valueEl) {
  if (valueEl.querySelector(".project-index__digits")) return;

  valueEl.textContent = "";
  const digitsWrap = document.createElement("span");
  digitsWrap.className = "project-index__digits";

  for (let i = 0; i < 2; i += 1) {
    const digit = document.createElement("span");
    digit.className = "project-index__digit";
    const strip = document.createElement("span");
    strip.className = "project-index__digit-strip is-instant";

    for (let d = 0; d <= 9; d += 1) {
      const char = document.createElement("span");
      char.className = "project-index__digit-char";
      char.textContent = String(d);
      strip.appendChild(char);
    }

    digit.appendChild(strip);
    digitsWrap.appendChild(digit);
  }

  valueEl.appendChild(digitsWrap);
}

function setOdometerValue(valueEl, value, animate = true) {
  ensureOdometer(valueEl);
  const normalized = String(value).padStart(2, "0");
  const strips = valueEl.querySelectorAll(".project-index__digit-strip");
  const chars = normalized.split("");
  const step =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--index-digit-step")) ||
    54.4;

  strips.forEach((strip, i) => {
    strip.classList.toggle("is-instant", !animate);
    strip.style.transform = `translateY(-${parseInt(chars[i], 10) * step}px)`;
  });

  if (animate) {
    requestAnimationFrame(() => {
      strips.forEach((strip) => strip.classList.remove("is-instant"));
    });
  }

  valueEl.dataset.currentValue = normalized;
}

const INDEX_ODOMETER_MS = 980;
const HEADER_LAND_TOLERANCE = 2;
const HEADER_COMPOSE_TOLERANCE = 2;

/** One scroll gesture = one section landing, then stop */
const LANDING_STEP = {
  landTolerance: 3,
  settleCooldownMs: 220,
  snapDuration: 0.48,
  easing: (t) => 1 - Math.pow(1 - t, 3),
};

let sectionLandingYs = [];

function getStickyLine() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sticky-top")) || 40;
}

function getSectionHeaderMetrics(project) {
  const topContent = project.querySelector(".project__top-content");
  const metaHeader = project.querySelector(".project__meta");
  if (!topContent || !metaHeader) return null;

  const tcTop = topContent.getBoundingClientRect().top;
  const ruleTop = metaHeader.getBoundingClientRect().top;

  return {
    tcTop,
    ruleTop,
    composed: Math.abs(tcTop - ruleTop) <= HEADER_COMPOSE_TOLERANCE,
  };
}

function isSectionInLandingBand(project) {
  const metrics = getSectionHeaderMetrics(project);
  if (!metrics) return false;

  const stickyLine = getStickyLine();
  const landLine = stickyLine + HEADER_LAND_TOLERANCE;

  return (
    metrics.tcTop <= landLine + HEADER_LAND_TOLERANCE &&
    metrics.tcTop >= stickyLine - 8
  );
}

function isSectionComposedLanding(project) {
  const metrics = getSectionHeaderMetrics(project);
  if (!metrics || !isSectionInLandingBand(project)) return false;

  const landLine = getStickyLine() + HEADER_LAND_TOLERANCE;

  if (metrics.composed) return true;

  // Handoff gap: title engages sticky before meta separates
  return metrics.ruleTop <= landLine;
}

function isSectionStickyHold(project) {
  const metrics = getSectionHeaderMetrics(project);
  if (!metrics) return false;
  if (metrics.composed) return false;

  return Math.abs(metrics.tcTop - getStickyLine()) <= HEADER_LAND_TOLERANCE;
}

function isSectionHeaderLanded(project) {
  return isSectionComposedLanding(project) || isSectionStickyHold(project);
}

function shouldTrackFirstFold(projects, activeIndex) {
  if (activeIndex !== 0) return false;

  const firstProject = projects[0];
  if (!firstProject || isSectionHeaderLanded(firstProject)) return false;

  const titleRow = firstProject.querySelector(".project__title-row");
  if (!titleRow) return false;

  const titleTop = titleRow.getBoundingClientRect().top;
  const stickyLine = getStickyLine();

  // Only track while Column is approaching the slot — not after it scrolls away.
  return titleTop >= stickyLine - 12 && titleTop <= window.innerHeight + 40;
}

function positionProjectIndex(indexEl, projects, activeIndex = 0) {
  const spacer =
    projects[0]?.querySelector(".project__index-spacer") ||
    projects.find((project) => project.querySelector(".project__index-spacer"))?.querySelector(
      ".project__index-spacer"
    );
  if (!spacer) return;

  indexEl.style.left =
    document.documentElement.style.getPropertyValue("--index-fixed-left") ||
    `${spacer.getBoundingClientRect().left}px`;

  const trackFirstFold = shouldTrackFirstFold(projects, activeIndex);

  if (trackFirstFold) {
    const titleRow = projects[0].querySelector(".project__title-row");
    if (titleRow) {
      indexEl.style.top = `${titleRow.getBoundingClientRect().top}px`;
      return;
    }
  }

  indexEl.style.top =
    document.documentElement.style.getPropertyValue("--index-fixed-top") ||
    `${getStickyLine()}px`;
}

function setIndexValue(indexEl, nextValue) {
  const valueEl = getIndexValueEl(indexEl);
  ensureOdometer(valueEl);

  const normalized = String(nextValue).padStart(2, "0");
  const current = valueEl.dataset.currentValue || "01";

  if (current === normalized && !indexEl.classList.contains("is-changing")) return;
  if (indexEl.dataset.pendingIndexValue === normalized) return;

  if (indexEl._indexChangeTimer) {
    clearTimeout(indexEl._indexChangeTimer);
    setOdometerValue(valueEl, current, false);
  }

  indexEl.dataset.pendingIndexValue = normalized;
  indexEl.classList.add("is-changing");
  setOdometerValue(valueEl, normalized, true);
  indexEl.setAttribute("aria-label", `Section ${normalized}`);

  indexEl._indexChangeTimer = window.setTimeout(() => {
    indexEl.classList.remove("is-changing");
    delete indexEl.dataset.pendingIndexValue;
    indexEl._indexChangeTimer = null;
  }, INDEX_ODOMETER_MS);
}

function shouldShowProjectIndex(projects) {
  const lastProject = projects[projects.length - 1];
  const lastRect = lastProject.getBoundingClientRect();

  if (lastRect.bottom < window.innerHeight * 0.15) {
    return false;
  }

  return projects.some((project) => {
    const rect = project.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  });
}

function getActiveProjectIndex(projects, previousActive = 0, scrollingDown = true) {
  const landLine = getStickyLine() + HEADER_LAND_TOLERANCE;
  const approachRange = 120;

  // Title hitting the landing frame — pick the frontmost arrival (highest top).
  let bestComposed = -1;
  let bestTop = -Infinity;

  for (let i = 0; i < projects.length; i += 1) {
    const metrics = getSectionHeaderMetrics(projects[i]);
    if (!metrics || !isSectionComposedLanding(projects[i])) continue;

    if (metrics.tcTop > bestTop || (Math.abs(metrics.tcTop - bestTop) < 0.5 && i > bestComposed)) {
      bestTop = metrics.tcTop;
      bestComposed = i;
    }
  }

  if (bestComposed >= 0) {
    if (scrollingDown) {
      if (bestComposed > previousActive) {
        return isSectionHeaderLanded(projects[bestComposed]) ? bestComposed : previousActive;
      }
      return bestComposed;
    }

    if (bestComposed >= previousActive) {
      return bestComposed;
    }

    // Scrolling up — keep the current number until the earlier section has landed.
    if (isSectionHeaderLanded(projects[bestComposed])) {
      return bestComposed;
    }

    return previousActive;
  }

  for (let i = projects.length - 1; i >= 0; i -= 1) {
    if (isSectionStickyHold(projects[i])) return i;
  }

  const previousProject = projects[previousActive];
  if (previousProject) {
    if (isSectionStickyHold(previousProject)) return previousActive;

    const previousMetrics = getSectionHeaderMetrics(previousProject);
    if (
      previousMetrics &&
      previousMetrics.tcTop > landLine &&
      previousMetrics.tcTop <= landLine + approachRange
    ) {
      return previousActive;
    }
  }

  return previousActive;
}

function updateProjectIndexValue(indexEl, projects, previousActive = 0, scrollingDown = true) {
  if (!shouldShowProjectIndex(projects)) {
    indexEl.classList.remove("is-visible");
    indexEl.setAttribute("aria-hidden", "true");
    projects.forEach((project) => project.classList.remove("is-index-active"));
    return previousActive;
  }

  const activeIndex = getActiveProjectIndex(projects, previousActive, scrollingDown);

  projects.forEach((project, i) => {
    project.classList.toggle("is-index-active", i === activeIndex);
  });

  setIndexValue(indexEl, projects[activeIndex].dataset.projectIndex);
  indexEl.classList.add("is-visible");
  indexEl.removeAttribute("aria-hidden");
  positionProjectIndex(indexEl, projects, activeIndex);

  return activeIndex;
}

function scheduleMeasureSectionLayout() {
  window.clearTimeout(scheduleMeasureSectionLayout._timer);
  scheduleMeasureSectionLayout._timer = window.setTimeout(measureSectionLayout, 120);
}

function getViewportHeight() {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function measureSectionLayout() {
  measureFoldPeek();

  const projects = [...document.querySelectorAll(".project")];

  measureFoldHold(projects);

  const indexEl = document.getElementById("project-index");
  if (indexEl) {
    measureFixedIndexPosition(indexEl);
    measureIndexSlot(indexEl);
    if (indexEl.classList.contains("is-visible")) {
      const activeIndex = projects.findIndex((project) =>
        project.classList.contains("is-index-active")
      );
      positionProjectIndex(
        indexEl,
        projects,
        activeIndex >= 0 ? activeIndex : 0
      );
    }
  }
}

function getFoldPeek() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fold-peek")) || 143;
}

function getFooterBottomTarget() {
  const footerPaddingBottom =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--page-padding")) || 16;
  return getViewportHeight() - footerPaddingBottom;
}

function getLandingMeasureDelta(peekTarget, alignMode = "peekTop") {
  if (alignMode === "footerBottom") {
    const footerEl = document.querySelector(".footer");
    if (!footerEl) return Infinity;
    return Math.abs(footerEl.getBoundingClientRect().bottom - getFooterBottomTarget());
  }

  if (!peekTarget) return 0;

  const targetTop = getViewportHeight() - getFoldPeek();
  return Math.abs(peekTarget.getBoundingClientRect().top - targetTop);
}

function scrollToY(y) {
  window.scrollTo(0, y);
}

function isComposedAt(project, y) {
  scrollToY(y);
  return isSectionComposedLanding(project);
}

function findFirstComposedY(project, start, end) {
  if (isComposedAt(project, start)) return start;

  let lo = start;
  let hi = end;
  let result = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (isComposedAt(project, mid)) {
      result = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return result;
}

function findBestComposedY(project, start, end, peekTarget, alignMode) {
  const firstY = findFirstComposedY(project, start, end);
  if (firstY == null) return null;

  let bestY = firstY;
  scrollToY(firstY);
  let bestDelta = getLandingMeasureDelta(peekTarget, alignMode);

  for (let y = firstY - 16; y <= firstY + 16; y += 2) {
    if (y < start || y > end) continue;
    if (!isComposedAt(project, y)) continue;

    const delta = getLandingMeasureDelta(peekTarget, alignMode);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestY = y;
    }
  }

  for (let y = Math.max(start, bestY - 2); y <= Math.min(end, bestY + 2); y += 1) {
    if (!isComposedAt(project, y)) continue;

    const delta = getLandingMeasureDelta(peekTarget, alignMode);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestY = y;
    }
  }

  return bestY;
}

function findLandingScrollY(project, peekTarget = null, alignMode = "peekTop") {
  const title = project.querySelector(".project__top-content");
  if (!title) return null;

  const approx = project.offsetTop + title.offsetTop - getStickyLine();
  const start = Math.max(0, approx - 500);
  const end = Math.min(
    document.documentElement.scrollHeight - 1,
    approx + Math.max(project.offsetHeight, getViewportHeight() * 2)
  );
  const optimizeLanding = peekTarget != null || alignMode === "footerBottom";

  if (!optimizeLanding) {
    return findFirstComposedY(project, start, end);
  }

  return findBestComposedY(project, start, end, peekTarget, alignMode);
}

function cacheSectionLandingY(project, peekTarget = null, alignMode = "peekTop") {
  const landingY =
    alignMode === "footerBottom"
      ? findLandingScrollY(project, peekTarget, alignMode)
      : findCenteredLandingScrollY(project);
  if (landingY == null) return null;

  project.dataset.landingScrollY = String(landingY);
  return { project, y: landingY };
}

function getFoldContentHeight() {
  return getViewportHeight() - getStickyLine() - getFoldPeek();
}

function getMetaBlockHeight() {
  const root = getComputedStyle(document.documentElement);
  const rule = parseFloat(root.getPropertyValue("--header-rule-size")) || 2;
  const gap = parseFloat(root.getPropertyValue("--header-text-gap")) || 16;
  const metaLh = parseFloat(root.getPropertyValue("--text-meta-lh")) || 19.5;
  const lines = parseFloat(root.getPropertyValue("--meta-desc-lines")) || 5;
  return rule + gap + metaLh * lines + 8;
}

function readCssPx(name, fallback = 0) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function measureProjectGridHeight(project) {
  const grid = project.querySelector(".project__grid");
  if (!grid) return 0;
  return grid.getBoundingClientRect().height;
}

/** Center meta + tiles in the fold band (nav → viewport − peek). */
function calibrateCenteredHold(project) {
  const metaBlockH = getMetaBlockHeight();
  const gridGap = readCssPx("--grid-row-gap", 24);
  const gridH = measureProjectGridHeight(project);
  const foldContentH = getFoldContentHeight();
  const contentH = metaBlockH + gridGap + gridH;
  const slack = foldContentH - contentH;
  const hold = Math.max(0, Math.round(slack / 2));

  project.style.setProperty("--header-scroll-hold", `${hold}px`);
  return hold;
}

function findCenteredLandingScrollY(project) {
  const hold = parseFloat(getComputedStyle(project).getPropertyValue("--header-scroll-hold")) || 0;
  const metaBlockH = getMetaBlockHeight();
  const gridGap = readCssPx("--grid-row-gap", 24);
  const targetGridTop = getStickyLine() + metaBlockH + hold + gridGap;
  const grid = project.querySelector(".project__grid");
  const title = project.querySelector(".project__top-content");
  if (!grid || !title) return null;

  const approx = project.offsetTop + grid.offsetTop - targetGridTop;
  const start = Math.max(0, approx - 800);
  const end = Math.min(
    document.documentElement.scrollHeight - 1,
    approx + Math.max(project.offsetHeight, getViewportHeight() * 2)
  );

  let bestY = null;
  let bestDelta = Infinity;

  for (let y = start; y <= end; y += 4) {
    scrollToY(y);
    if (!isSectionComposedLanding(project)) continue;

    const delta = Math.abs(grid.getBoundingClientRect().top - targetGridTop);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestY = y;
    }
  }

  if (bestY == null) return null;

  for (let y = Math.max(start, bestY - 6); y <= Math.min(end, bestY + 6); y += 1) {
    scrollToY(y);
    if (!isSectionComposedLanding(project)) continue;

    const delta = Math.abs(grid.getBoundingClientRect().top - targetGridTop);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestY = y;
    }
  }

  return bestY;
}

function getTitleDocumentTop(project) {
  const title = project.querySelector(".project__top-content");
  if (!title) return project.offsetTop;
  return title.getBoundingClientRect().top + window.scrollY;
}

function getMinLandingScrollY(project) {
  return getTitleDocumentTop(project) - getStickyLine();
}

/** Last section needs extra scroll room — otherwise the title never reaches the fold. */
function ensureLastSectionScrollPad(project) {
  const MAX_PAD = 3000;
  let pad = 0;
  project.style.setProperty("--last-section-scroll-pad", "0px");

  for (let attempt = 0; attempt < 32; attempt += 1) {
    project.style.setProperty("--last-section-scroll-pad", `${pad}px`);

    const maxScroll = document.documentElement.scrollHeight - getViewportHeight();
    const deficit = getMinLandingScrollY(project) - maxScroll;

    calibrateCenteredHold(project);
    const landingY = findCenteredLandingScrollY(project);

    if (landingY != null && landingY <= maxScroll + 1) {
      return;
    }

    pad += deficit > 0 ? Math.ceil(deficit) + 8 : 48;
    if (pad > MAX_PAD) break;
  }
}

function measureFoldHold(projects) {
  if (!projects.length) return;

  const savedY = document.documentElement.classList.contains("is-calibrating") ? 0 : window.scrollY;
  const cachedLandings = [];

  projects.forEach((project) => {
    calibrateCenteredHold(project);
  });

  projects.forEach((project, index) => {
    const isLastProject = index === projects.length - 1;

    if (isLastProject) {
      ensureLastSectionScrollPad(project);
      calibrateCenteredHold(project);
    }

    const landing = cacheSectionLandingY(project);
    if (landing) cachedLandings.push(landing);
  });

  sectionLandingYs = [{ y: 0 }, ...cachedLandings].sort((a, b) => a.y - b.y);

  window.scrollTo(0, savedY);
  window.dispatchEvent(new Event("scroll"));
}

const FOLD_PEEK_PX = 143;

function measureFoldPeek() {
  const viewportH = getViewportHeight();
  document.documentElement.style.setProperty("--viewport-h", `${viewportH}px`);
  document.documentElement.style.setProperty("--fold-peek", `${FOLD_PEEK_PX}px`);
}

const TILE_ROWS = 3;
const TILE_COLS = 4;

function buildSection(section) {
  const article = document.createElement("article");
  article.className = "project";
  article.id = section.id;

  article.innerHTML = `
    <div class="project__inner">
      <div class="project__meta-shell">
        <header class="project__meta">
          <div class="project__meta-copy">
            <div class="project__meta-desc">
              ${section.description.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
            </div>
            <div class="project__meta-desc">
              ${section.description2.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
            </div>
          </div>
        </header>
      </div>
      <div class="project__body">
        <aside class="project__sidebar">
          <div class="project__top-content">
            <div class="project__title-row">
              <div class="project__index-slot">
                <span class="project__index-spacer" aria-hidden="true"></span>
              </div>
              <div class="project__name-box">
                <h2 class="project__name">
                  ${section.titleLines.map((line) => `<span class="project__name-line">${escapeHtml(line)}</span>`).join("")}
                </h2>
              </div>
            </div>
          </div>
          <div class="size-switcher" hidden aria-hidden="true">
            <button type="button" class="size-switcher__btn is-active" data-size="s">S</button>
            <button type="button" class="size-switcher__btn" data-size="m">M</button>
            <button type="button" class="size-switcher__btn" data-size="l">L</button>
          </div>
          <p class="project__case-study"${section.caseStudyUrl ? "" : " hidden"}>
            <a class="project__case-study-link" href="${escapeHtml(section.caseStudyUrl || "#")}">
              View full case study
            </a>
          </p>
        </aside>
        <div class="project__grid-wrap">
          <div class="project__grid" data-cols="${TILE_COLS}">
            ${buildTiles(section)}
          </div>
        </div>
      </div>
    </div>
  `;

  return article;
}

function getTileMediaItem(section, index) {
  return section.media?.[index] ?? null;
}

function resolveMediaType(item) {
  if (!item?.src) return null;
  if (item.type === "video") return "video";
  if (item.type === "image") return "image";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(item.src)) return "video";
  return "image";
}

function buildTileMediaHtml(media, label) {
  if (!media?.src) {
    return '<span class="tile-inner__placeholder" aria-hidden="true"></span>';
  }

  const type = resolveMediaType(media);
  const src = escapeHtml(media.src);
  const alt = escapeHtml(media.alt || label);

  if (type === "video") {
    const poster = media.poster ? ` poster="${escapeHtml(media.poster)}"` : "";
    return `<video class="tile-inner__media" src="${src}"${poster} autoplay muted loop playsinline preload="metadata" aria-label="${alt}"></video>`;
  }

  return `<img class="tile-inner__media" src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
}

function buildTiles(section) {
  const count = TILE_ROWS * TILE_COLS;

  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    const label = `${section.title} — media ${index}`;
    const mediaItem = getTileMediaItem(section, i);

    return `
      <div class="tile-wrap">
        <button
          type="button"
          class="tile-inner"
          data-tile-index="${index}"
          aria-label="View ${escapeHtml(label)}"
        >
          ${buildTileMediaHtml(mediaItem, label)}
        </button>
      </div>
    `;
  }).join("");
}

function initTileVideos() {
  const videos = [...document.querySelectorAll(".tile-inner__media")].filter(
    (el) => el.tagName === "VIDEO"
  );
  if (!videos.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.2 }
  );

  videos.forEach((video) => observer.observe(video));
}

function createLightboxMedia(tile) {
  const source = tile.querySelector(".tile-inner__media");
  if (!source) {
    const placeholder = document.createElement("span");
    placeholder.className = "lightbox__placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    return placeholder;
  }

  if (source.tagName === "VIDEO") {
    const video = document.createElement("video");
    video.className = "lightbox__media";
    video.src = source.currentSrc || source.src;
    if (source.poster) video.poster = source.poster;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = true;
    video.setAttribute("aria-label", source.getAttribute("aria-label") || "Project video");
    return video;
  }

  const image = document.createElement("img");
  image.className = "lightbox__media";
  image.src = source.currentSrc || source.src;
  image.alt = source.alt || "";
  return image;
}

function initTileLightbox(scroll) {
  const lightbox = document.getElementById("lightbox");
  const stage = lightbox?.querySelector(".lightbox__stage");
  const backdrop = lightbox?.querySelector(".lightbox__backdrop");
  const backBtn = lightbox?.querySelector(".lightbox__control--back");
  const prevBtn = lightbox?.querySelector(".lightbox__control--prev");
  const nextBtn = lightbox?.querySelector(".lightbox__control--next");
  if (!lightbox || !stage || !backdrop) return;

  const lenis = scroll?.lenis ?? null;
  const tiles = () => [...document.querySelectorAll(".tile-inner")];
  let activeTile = null;

  const renderStage = (tile) => {
    stage.innerHTML = "";

    const frame = document.createElement("div");
    frame.className = "lightbox__frame";
    frame.appendChild(createLightboxMedia(tile));
    stage.appendChild(frame);

    const video = frame.querySelector("video.lightbox__media");
    if (video) video.play().catch(() => {});
  };

  const openLightbox = (tile) => {
    activeTile = tile;
    tile.classList.add("is-lightbox-source");
    renderStage(tile);
    lightbox.hidden = false;
    document.body.classList.add("is-lightbox-open");
    lenis?.stop();
    backBtn?.focus();
  };

  const closeLightbox = () => {
    if (!activeTile) return;

    activeTile.classList.remove("is-lightbox-source");
    activeTile = null;
    lightbox.hidden = true;
    stage.querySelectorAll("video.lightbox__media").forEach((video) => video.pause());
    stage.innerHTML = "";
    document.body.classList.remove("is-lightbox-open");
    lenis?.start();
  };

  const stepLightbox = (direction) => {
    const all = tiles();
    const currentIndex = activeTile ? all.indexOf(activeTile) : -1;
    if (currentIndex < 0 || !all.length) return;

    const nextIndex =
      direction < 0
        ? (currentIndex - 1 + all.length) % all.length
        : (currentIndex + 1) % all.length;

    activeTile.classList.remove("is-lightbox-source");
    activeTile = all[nextIndex];
    activeTile.classList.add("is-lightbox-source");
    renderStage(activeTile);
  };

  const openLightboxAt = (allTiles, index) => {
    const tile = allTiles[index];
    if (!tile) return;

    if (activeTile) activeTile.classList.remove("is-lightbox-source");
    activeTile = tile;
    openLightbox(tile);
  };

  document.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile-inner");
    if (!tile || lightbox.hidden === false) return;

    event.preventDefault();
    openLightbox(tile);
  });

  backdrop.addEventListener("click", closeLightbox);
  backBtn?.addEventListener("click", closeLightbox);
  prevBtn?.addEventListener("click", () => stepLightbox(-1));
  nextBtn?.addEventListener("click", () => stepLightbox(1));

  lightbox.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  lightbox.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

  stage.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;

    const all = tiles();
    const currentIndex = activeTile ? all.indexOf(activeTile) : -1;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        if (currentIndex >= 0) stepLightbox(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        if (currentIndex >= 0) stepLightbox(-1);
        break;
      case "Escape":
        event.preventDefault();
        closeLightbox();
        break;
      default:
        break;
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
