/**
 * Portfolio framework — ryry.io-style sticky titles + tile lightbox
 */

import Lenis from "./vendor/lenis.mjs";
import { initNavBrand } from "./site-nav.js";
import { initFooter } from "./footer.js";
import { initHeroIntro } from "./hero-intro.js";

const landingSettleHandlers = new Set();

function notifyLandingSettle(targetY) {
  landingSettleHandlers.forEach((handler) => handler(targetY));
}

/** Sections with `published: false` stay in JSON as drafts/templates and are omitted from the index. */
function getPublishedSections(sections) {
  return sections.filter((section) => section.published !== false);
}

async function init() {
  beginCalibration();

  const main = document.getElementById("projects");
  if (!main) {
    endCalibration();
    return;
  }

  const response = await fetch("./data/projects.json?v=onboarding-reupload-4");
  const data = await response.json();

  getPublishedSections(data.sections).forEach((section) => {
    main.appendChild(buildSection(section));
  });

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  measureSectionLayout();
  cachedLayoutMode = syncLayoutMode();
  window.addEventListener("resize", scheduleMeasureSectionLayout);
  window.visualViewport?.addEventListener("resize", scheduleMeasureSectionLayout);
  window.addEventListener("resize", () => {
    const layout = syncLayoutMode();
    if (layout !== cachedLayoutMode) {
      cachedLayoutMode = layout;
      measureSectionLayout();
    }
    clearCompactMetaHidden([...document.querySelectorAll(".project")]);
  });

  initFooter(data);
  initNavBrand(data.site);
  initHeroStatement(data.site);

  const scroll = initSmoothScroll();
  portfolioScroll = scroll;
  // Hero click ritual paused — keep project bleed visible by default while portfolio work continues.
  const ENABLE_HERO_INTRO = false;
  if (ENABLE_HERO_INTRO && data.site?.intro) {
    initHeroIntro(data, scroll, {
      onStepChange: () => {
        measureFoldPeek();
        scheduleMeasureSectionLayout();
      },
    });
  } else {
    document.documentElement.classList.add("hero--bleed");
    scheduleMeasureSectionLayout();
  }
  initTileLightbox(scroll);
  initTileVideos();
  initProjectIndex(scroll);
  initHeaderCover(scroll);
  initHeroStatementCover(scroll);

  endCalibration(scroll);
  cachedLayoutMode = syncLayoutMode();
}

function getTabletRuleTop(project) {
  const titleRow = project.querySelector(".project__title-row");
  if (!titleRow) return null;

  const textGap = readCssPx("--header-text-gap", 16);
  return titleRow.getBoundingClientRect().top - textGap;
}

function isTabletRuleLanded(project) {
  const ruleTop = getTabletRuleTop(project);
  if (ruleTop == null) return false;

  return Math.abs(ruleTop - getStickyLine()) <= TABLET_RULE_TOLERANCE;
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

function initHeroStatement(site) {
  const hero = document.getElementById("intro");
  const paragraphs = normalizeHeroStatement(site?.statement);
  if (!hero || !paragraphs.length) return;

  // Keep the click-ritual hero markup out of the way while intro is paused.
  hero.innerHTML = `<div class="hero__statement-shell"><div class="hero__statement">${paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("")}</div></div>`;

  measureHeroStatementPosition();
}

function normalizeHeroStatement(statement) {
  if (!Array.isArray(statement) || !statement.length) return [];

  if (typeof statement[0] === "string") {
    return statement.filter(Boolean);
  }

  return statement
    .filter((paragraph) => Array.isArray(paragraph) && paragraph.length)
    .map((paragraph) => paragraph.filter(Boolean).join(" "));
}

function isNavRoleVisible(role) {
  if (!role) return false;
  return getComputedStyle(role).display !== "none" && role.getClientRects().length > 0;
}

function getHeroStatementAboutAnchor() {
  return (
    document.querySelector('.nav__link[href="./about.html"]') ||
    document.querySelector(".nav__end")
  );
}

function getHeroStatementBrandAnchor() {
  return document.querySelector(".nav__brand");
}

/** Left-edge anchor: Product Designer when visible, else page rail (stacked). */
function getHeroStatementLeftAnchor() {
  if (window.matchMedia(HERO_STATEMENT_STACKED_MQ).matches) {
    return null;
  }

  const role = document.querySelector(".nav__role");
  if (isNavRoleVisible(role)) return role;

  return getHeroStatementBrandAnchor();
}

/** Right-edge anchor: About link — same span as nav end cap. */
function getHeroStatementRightAnchor() {
  return getHeroStatementAboutAnchor();
}

function getHeroFoldDividerTop() {
  const firstProject = document.querySelector(".project");
  const foldFallback = window.innerHeight - readCssPx("--fold-peek", 143);

  if (!firstProject) return foldFallback;

  if (isStackedLayout()) {
    const ruleTop = getTabletRuleTop(firstProject);
    if (ruleTop != null) return ruleTop + window.scrollY;
  }

  const meta = firstProject.querySelector(".project__meta");
  if (meta) {
    return meta.getBoundingClientRect().top + window.scrollY;
  }

  return foldFallback;
}

function measureHeroStatementPosition() {
  const shell = document.querySelector(".hero__statement-shell");
  const statement = shell?.querySelector(".hero__statement");
  if (!shell || !statement) return;

  const shellRect = shell.getBoundingClientRect();
  const leftAnchor = getHeroStatementLeftAnchor();
  const rightAnchor = getHeroStatementRightAnchor();

  const left = leftAnchor
    ? Math.round(leftAnchor.getBoundingClientRect().left)
    : Math.round(shellRect.left);
  const right = rightAnchor
    ? Math.round(rightAnchor.getBoundingClientRect().right)
    : Math.round(shellRect.right);
  const width = Math.max(0, right - left);
  const shellOffset = left - shellRect.left;

  shell.style.marginLeft = shellOffset > 0 ? `${shellOffset}px` : "0";
  shell.style.width = `${width}px`;
  shell.style.maxWidth = `${width}px`;

  document.documentElement.style.setProperty("--hero-statement-fixed-width", `${width}px`);
  document.documentElement.style.setProperty("--hero-statement-fixed-left", `${left}px`);

  const stickyTop = readCssPx("--sticky-top", 40);
  const gap = readCssPx("--header-text-gap", 16);
  const statementHeight = statement.offsetHeight;
  let top;

  if (isStackedLayout()) {
    top = Math.round(stickyTop + gap);
  } else {
    const bandTop = stickyTop;
    const firstProject = document.querySelector(".project");
    const foldFallback = window.innerHeight - readCssPx("--fold-peek", 143);
    const meta = firstProject?.querySelector(".project__meta");
    const bandBottom = meta
      ? Math.round(meta.getBoundingClientRect().top)
      : foldFallback;
    const bandHeight = Math.max(0, bandBottom - bandTop);
    top = Math.round(bandTop + Math.max(0, (bandHeight - statementHeight) / 2));
  }

  document.documentElement.style.setProperty("--hero-statement-top", `${top}px`);

  shell.style.minHeight = `${statementHeight}px`;
}

function getHeroStatementBandBottom() {
  const statement = document.querySelector(".hero__statement");
  if (!statement) {
    return getStickyLine() + readCssPx("--header-text-gap", 16);
  }

  return statement.getBoundingClientRect().bottom;
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
      syncTouch: window.matchMedia("(max-width: 1023px)").matches,
      touchMultiplier: 1.15,
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

function getTerminalScrollY() {
  const lastProject = getLastProject();
  if (!lastProject) return null;

  const landingY = parseFloat(lastProject.dataset.landingScrollY);
  return Number.isFinite(landingY) ? landingY : null;
}

function getLastProject(projects = [...document.querySelectorAll(".project")]) {
  return projects.length ? projects[projects.length - 1] : null;
}

function isTerminalLandingY(y) {
  const terminalY = getTerminalScrollY();
  return terminalY != null && Math.abs(y - terminalY) <= LANDING_STEP.landTolerance;
}

function showLastFoldFooter() {
  const footerShell = document.querySelector(".footer-shell");
  if (!footerShell) return;

  footerShell.classList.add("is-visible");
  document.documentElement.classList.add("is-last-fold");
  measureFooterChrome();
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

  const pinAtLanding = (targetY) => {
    lenis.scrollTo(targetY, { immediate: true, force: true });
    lenis.targetScroll = targetY;
    lenis.animatedScroll = targetY;
    lenis.velocity = 0;
    lenis.lastVelocity = 0;
    lenis.animate?.stop?.();
  };

  const pinAtTerminal = (targetY) => {
    pinAtLanding(targetY);
    notifyLandingSettle(targetY);
    if (isTerminalLandingY(targetY)) showLastFoldFooter();
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
        if (isTerminalLandingY(targetY)) showLastFoldFooter();
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
      if (!document.documentElement.classList.contains("hero--bleed") && lenis.animatedScroll <= 1) {
        return blockWheel(event);
      }
      if (isSettling) return blockWheel(event);

      if (performance.now() < settleUntil) {
        return blockWheel(event);
      }

      const direction = Math.sign(deltaY);
      if (!direction) return;

      const terminalY = getTerminalScrollY();
      if (
        terminalY != null &&
        direction > 0 &&
        lenis.animatedScroll >= terminalY - LANDING_STEP.landTolerance
      ) {
        scrollSession = null;
        pinAtTerminal(terminalY);
        return blockWheel(event);
      }

      if (!scrollSession) {
        const target = findNextLanding(lenis.animatedScroll, direction);
        if (!target) {
          const onLanding = getSectionLandingYs().find(
            (landing) => Math.abs(landing.y - lenis.animatedScroll) <= LANDING_STEP.landTolerance
          );
          if (onLanding && direction > 0) {
            pinAtTerminal(onLanding.y);
            return blockWheel(event);
          }
          return;
        }
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
      if (!lenis || isSettling) return;

      const terminalY = getTerminalScrollY();
      if (terminalY != null && lenis.animatedScroll > terminalY + LANDING_STEP.landTolerance) {
        scrollSession = null;
        pinAtTerminal(terminalY);
        return;
      }

      if (!scrollSession) return;

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

function initHeaderCover(scroll) {
  const projects = [...document.querySelectorAll(".project")];
  if (!projects.length) return;

  let lastScrollY = window.scrollY;

  const update = () => {
    if (isStackedLayout()) {
      clearCompactMetaHidden(projects);
      return;
    }

    const scrollingDown = window.scrollY >= lastScrollY;
    lastScrollY = window.scrollY;

    projects.forEach((project) => {
      const grid = project.querySelector(".project__grid-wrap");
      const metaCopy = project.querySelector(".project__meta-copy");
      if (!grid || !metaCopy) return;

      const gridTop = grid.getBoundingClientRect().top;
      const copyRect = metaCopy.getBoundingClientRect();
      const tilesReached = gridTop < copyRect.bottom;

      if (isSectionComposedLanding(project) && !scrollingDown) {
        project.classList.remove("is-meta-hidden");
        return;
      }

      if (isSectionComposedLanding(project) && !tilesReached) {
        project.classList.remove("is-meta-hidden");
        return;
      }

      project.classList.toggle("is-meta-hidden", tilesReached);
    });
  };

  update();
  scroll.onScroll(update);
  scroll.onFrame(update);
  window.addEventListener("resize", update);
}

function initHeroStatementCover(scroll) {
  const hero = document.getElementById("intro");
  const statement = hero?.querySelector(".hero__statement");
  const firstProject = document.querySelector(".project");
  if (!hero || !statement || !firstProject) return;

  let lastScrollY = window.scrollY;

  const update = () => {
    const scrollingDown = window.scrollY >= lastScrollY;
    lastScrollY = window.scrollY;

    const titleRow = firstProject.querySelector(".project__title-row");
    if (!titleRow) return;

    if (window.scrollY <= 1) {
      hero.classList.remove("is-statement-hidden");
      return;
    }

    const titleTop = titleRow.getBoundingClientRect().top;
    const bandBottom = getHeroStatementBandBottom();
    const covered = titleTop <= bandBottom;

    if (isStackedLayout()) {
      hero.classList.toggle("is-statement-hidden", covered);
      return;
    }

    if (isSectionComposedLanding(firstProject) && !scrollingDown) {
      hero.classList.toggle(
        "is-statement-hidden",
        covered || isSectionHeaderLanded(firstProject)
      );
      return;
    }

    if (isSectionComposedLanding(firstProject) && !covered) {
      hero.classList.remove("is-statement-hidden");
      return;
    }

    hero.classList.toggle("is-statement-hidden", covered);
  };

  update();
  scroll.onScroll(update);
  scroll.onFrame(update);
  window.addEventListener("resize", () => {
    measureHeroStatementPosition();
    update();
  });
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
  let lastScrollY = getActiveScrollY(scroll);

  const update = () => {
    const scrollY = getActiveScrollY(scroll);
    const scrollingDown = scrollY >= lastScrollY;
    lastScrollY = scrollY;
    activeIndex = updateProjectIndexValue(indexEl, projects, activeIndex, scrollingDown);
    updateFooterShell(projects);
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
    updateFooterShell(projects);
  });
  scroll.onFrame(() => {
    updateFooterShell(projects);

    if (!indexEl.classList.contains("is-visible")) return;
    const currentActive = projects.findIndex((project) =>
      project.classList.contains("is-index-active")
    );
    positionProjectIndex(indexEl, projects, currentActive >= 0 ? currentActive : activeIndex);

    maybeStartIndexSpin(indexEl, projects, activeIndex);

    const nextIndex = resolveOdometerIndex(projects, indexEl);
    if (nextIndex !== activeIndex) {
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
  const textOffset = isStackedLayout()
    ? (parseFloat(rootStyle.getPropertyValue("--header-rule-size")) || 2) +
      (parseFloat(rootStyle.getPropertyValue("--header-text-gap")) || 16)
    : parseFloat(rootStyle.getPropertyValue("--header-text-offset")) ||
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
      "position:fixed;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;letter-spacing:0;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;";
    document.body.appendChild(probe);
  }

  const valueEl = getIndexValueEl(indexEl);
  ensureOdometer(valueEl);

  const style = getComputedStyle(indexEl);
  const sampleChar = valueEl.querySelector(".project-index__digit-char");
  probe.style.font = `${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`;

  let maxW = 0;
  for (let d = 0; d <= 9; d += 1) {
    probe.textContent = String(d);
    maxW = Math.max(maxW, probe.getBoundingClientRect().width);
  }

  const digitW = Math.ceil(maxW);
  const tracking =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--text-title-tracking")) || 0;
  const measuredStep = sampleChar
    ? sampleChar.getBoundingClientRect().height
    : (parseFloat(style.fontSize) || 64) * 0.85;
  const digitStep = Math.max(1, Math.ceil(measuredStep));

  document.documentElement.style.setProperty("--index-digit-w", `${digitW}px`);
  document.documentElement.style.setProperty("--index-slot-w", `${digitW * 2 + tracking}px`);
  document.documentElement.style.setProperty("--index-digit-step", `${digitStep}px`);
  indexEl.style.setProperty("--index-odometer-ms", `${INDEX_ODOMETER_MS}ms`);

  // Re-apply strip offsets after the step size changes.
  if (valueEl.dataset.currentValue) {
    setOdometerValue(valueEl, valueEl.dataset.currentValue, false);
  }
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
  const stepPx = Math.round(step);

  strips.forEach((strip, i) => {
    strip.classList.toggle("is-instant", !animate);
    strip.style.transform = `translate3d(0, -${parseInt(chars[i], 10) * stepPx}px, 0)`;
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
const TABLET_RULE_TOLERANCE = 4;

function getIndexDigitRect(indexEl) {
  const digit = indexEl?.querySelector(".project-index__digit");
  if (digit) return digit.getBoundingClientRect();
  return indexEl?.getBoundingClientRect() ?? { top: 0, bottom: 0, height: 0 };
}

function getTitleRowSlotState(projects, indexEl, projectIndex) {
  const indexRect = getIndexDigitRect(indexEl);
  const titleRow = projects[projectIndex]?.querySelector(".project__title-row");
  if (!indexRect?.height || !titleRow) {
    return { overlapping: false, aligned: false, engaged: false };
  }

  const rowRect = titleRow.getBoundingClientRect();
  const overlapping = rowRect.top <= indexRect.bottom + HEADER_LAND_TOLERANCE;
  const aligned = rowRect.top <= indexRect.top + HEADER_LAND_TOLERANCE;
  const engaged = rowRect.bottom > indexRect.top - 4;

  return { overlapping, aligned, engaged };
}

/** Index advances only after a section title overlaps the digit — not on peek or sticky alone. */
function resolveOdometerIndex(projects, indexEl) {
  let index = 0;

  for (let i = 0; i < projects.length; i += 1) {
    const state = getTitleRowSlotState(projects, indexEl, i);
    if (state.aligned) index = i;
  }

  for (let i = 0; i < projects.length - 1; i += 1) {
    const next = getTitleRowSlotState(projects, indexEl, i + 1);
    if (index === i && next.overlapping) index = i + 1;
  }

  for (let j = projects.length - 1; j >= 1; j -= 1) {
    const state = getTitleRowSlotState(projects, indexEl, j);
    if (index >= j && !state.overlapping && !state.aligned) index = j - 1;
  }

  return index;
}

/** Which project owns the index slot — skips titles that scrolled off above. */
function getIndexSlotProject(projects, indexEl) {
  let active = 0;

  for (let i = 0; i < projects.length; i += 1) {
    const state = getTitleRowSlotState(projects, indexEl, i);
    if (!state.engaged) continue;
    if (state.aligned) active = i;
  }

  return active;
}

/** Start the odometer roll when the next title first overlaps the digit. */
function maybeStartIndexSpin(indexEl, projects, activeIndex) {
  const nextIndex = activeIndex + 1;
  if (nextIndex >= projects.length) return;

  const state = getTitleRowSlotState(projects, indexEl, nextIndex);
  if (!state.overlapping) return;

  const spinKey = `${activeIndex}->${nextIndex}`;
  if (indexEl.dataset.indexSpinKey === spinKey) return;

  indexEl.dataset.indexSpinKey = spinKey;
  setIndexValue(indexEl, projects[nextIndex].dataset.projectIndex);
}

const COMPACT_LAYOUT_MQ = "(max-width: 600px)";
const TABLET_LAYOUT_MQ = "(max-width: 1023px) and (min-width: 601px)";
const HERO_STATEMENT_WIDE_MQ = "(min-width: 1400px)";
const HERO_STATEMENT_STACKED_MQ = "(max-width: 1023px)";

let cachedLayoutMode = null;

function isMobileLayout() {
  return window.matchMedia(COMPACT_LAYOUT_MQ).matches;
}

function isTabletLayout() {
  return window.matchMedia(TABLET_LAYOUT_MQ).matches;
}

function isStackedLayout() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function isCompactLayout() {
  return isStackedLayout();
}

function syncLayoutMode() {
  const layout = isMobileLayout() ? "mobile" : isTabletLayout() ? "tablet" : "desktop";
  document.documentElement.dataset.layout = layout;
}

function clearCompactMetaHidden(projects) {
  projects.forEach((project) => project.classList.remove("is-meta-hidden"));
}

/** One scroll gesture = one section landing, then stop */
const LANDING_STEP = {
  landTolerance: 3,
  settleCooldownMs: 220,
  snapDuration: 0.48,
  easing: (t) => 1 - Math.pow(1 - t, 3),
};

let sectionLandingYs = [];
let portfolioScroll = null;

function getActiveScrollY(scroll = portfolioScroll) {
  return scroll?.lenis?.animatedScroll ?? window.scrollY;
}

function getStickyLine() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sticky-top")) || 40;
}

function getSectionHeaderMetrics(project) {
  const topContent = project.querySelector(".project__top-content");
  if (!topContent) return null;

  const tcTop = topContent.getBoundingClientRect().top;
  const stickyLine = getStickyLine();
  let ruleTop;

  if (isStackedLayout()) {
    ruleTop = getTabletRuleTop(project) ?? tcTop;
  } else {
    const metaHeader = project.querySelector(".project__meta");
    ruleTop = metaHeader?.getBoundingClientRect().top ?? tcTop;
  }

  const composed = isStackedLayout()
    ? Math.abs(ruleTop - stickyLine) <= TABLET_RULE_TOLERANCE
    : Math.abs(tcTop - ruleTop) <= HEADER_COMPOSE_TOLERANCE;

  return {
    tcTop,
    ruleTop,
    composed,
  };
}

function isSectionInLandingBand(project) {
  const metrics = getSectionHeaderMetrics(project);
  if (!metrics) return false;

  if (isStackedLayout()) return isTabletRuleLanded(project);

  const stickyLine = getStickyLine();
  const landLine = stickyLine + HEADER_LAND_TOLERANCE;

  return (
    metrics.tcTop <= landLine + HEADER_LAND_TOLERANCE &&
    metrics.tcTop >= stickyLine - 8
  );
}

function isSectionComposedLanding(project) {
  if (isStackedLayout()) return isTabletRuleLanded(project);

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

/** First fold only: index rides the title until project 01 lands, then stays fixed. */
function shouldTrackFirstFold(projects) {
  const firstProject = projects[0];
  if (!firstProject || isSectionHeaderLanded(firstProject)) return false;

  const titleRow = firstProject.querySelector(".project__title-row");
  if (!titleRow) return false;

  const titleTop = titleRow.getBoundingClientRect().top;
  const stickyLine = getStickyLine();

  return titleTop >= stickyLine - 12 && titleTop <= window.innerHeight + 40;
}

/** Last fold only — track the live title row when the final project is active and landed. */
function shouldTrackLastFold(projects, activeIndex) {
  const lastIndex = projects.length - 1;
  if (activeIndex !== lastIndex || lastIndex < 0) return false;

  const lastProject = projects[lastIndex];
  return isSectionHeaderLanded(lastProject) || isSectionStickyHold(lastProject);
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

  if (shouldTrackFirstFold(projects)) {
    const titleRow = projects[0].querySelector(".project__title-row");
    if (titleRow) {
      indexEl.style.top = `${titleRow.getBoundingClientRect().top}px`;
      return;
    }
  }

  if (shouldTrackLastFold(projects, activeIndex)) {
    const titleRow = projects[activeIndex]?.querySelector(".project__title-row");
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
  const stickyLine = getStickyLine();
  const landTol = HEADER_LAND_TOLERANCE;
  const approachRange = 120;

  // Switch the odometer the moment a section's title/rule plane reaches the
  // sticky top — same instant the line + text pin. Do not wait for extra scroll
  // past "composed landing". Snap + odometer duration are unchanged.
  let best = -1;
  let bestAnchor = -Infinity;

  for (let i = 0; i < projects.length; i += 1) {
    const metrics = getSectionHeaderMetrics(projects[i]);
    if (!metrics) continue;

    const anchor = isStackedLayout() ? metrics.ruleTop : metrics.tcTop;
    // Still below the sticky plane — not yet time to switch.
    if (anchor > stickyLine + landTol) continue;

    // Among headers at/above the plane, pick the frontmost (highest anchor).
    // Tie-break toward the later section when scrolling the stack.
    if (anchor > bestAnchor || (Math.abs(anchor - bestAnchor) < 0.5 && i > best)) {
      bestAnchor = anchor;
      best = i;
    }
  }

  if (best >= 0) return best;

  for (let i = projects.length - 1; i >= 0; i -= 1) {
    if (isSectionStickyHold(projects[i])) return i;
  }

  const previousProject = projects[previousActive];
  if (previousProject) {
    if (isSectionStickyHold(previousProject)) return previousActive;

    const previousMetrics = getSectionHeaderMetrics(previousProject);
    if (
      previousMetrics &&
      previousMetrics.tcTop > stickyLine + landTol &&
      previousMetrics.tcTop <= stickyLine + landTol + approachRange
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
    delete indexEl.dataset.indexSpinKey;
    return previousActive;
  }

  maybeStartIndexSpin(indexEl, projects, previousActive);

  const activeIndex = resolveOdometerIndex(projects, indexEl);

  projects.forEach((project, i) => {
    project.classList.toggle("is-index-active", i === activeIndex);
  });

  const targetValue = projects[activeIndex].dataset.projectIndex;

  if (!indexEl.classList.contains("is-changing")) {
    setIndexValue(indexEl, targetValue);
  }

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

function measureMetaBlockHeights(projects) {
  const root = getComputedStyle(document.documentElement);
  const rule = parseFloat(root.getPropertyValue("--header-rule-size")) || 2;
  const gap = parseFloat(root.getPropertyValue("--header-text-gap")) || 16;
  const bottomPad = 8;
  const defaultDescH = parseFloat(root.getPropertyValue("--meta-desc-h")) || 136.5;

  projects.forEach((project) => {
    const copy = project.querySelector(".project__meta-copy");
    if (!copy) return;

    const cols = [...copy.querySelectorAll(".project__meta-desc")];
    let rowH;

    if (isStackedLayout() && copy.classList.contains("project__meta-copy--three")) {
      const stackGap = parseFloat(getComputedStyle(copy).rowGap) || 0;
      rowH = cols.reduce(
        (sum, col, index) => sum + col.scrollHeight + (index > 0 ? stackGap : 0),
        0,
      );
    } else {
      const tallest = cols.reduce((max, col) => Math.max(max, col.scrollHeight), 0);
      rowH = Math.max(defaultDescH, tallest);
    }

    const metaBlockH = rule + gap + rowH + bottomPad;
    project.style.setProperty("--meta-desc-h", `${rowH}px`);
    project.style.setProperty("--meta-block-h", `${metaBlockH}px`);
  });
}

function measureSectionLayout() {
  measureFoldPeek();
  measureHeroStatementPosition();

  const projects = [...document.querySelectorAll(".project")];

  measureMetaBlockHeights(projects);
  measureFoldHold(projects);

  updateFooterShell(projects);

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

function getFooterChromeHeight() {
  if (!document.documentElement.classList.contains("is-last-fold")) return 0;
  return (
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--footer-chrome-h")) || 0
  );
}

function isLastFoldActive(projects) {
  const lastProject = getLastProject(projects);
  if (!lastProject) return false;

  // Footer appears as soon as the last project lands in the fold — including snap arrival.
  if (isSectionHeaderLanded(lastProject)) return true;

  const landingY = parseFloat(lastProject.dataset.landingScrollY);
  if (Number.isFinite(landingY)) {
    return getActiveScrollY() >= landingY - HEADER_LAND_TOLERANCE;
  }

  return false;
}

function updateFooterShell(projects) {
  const footerShell = document.querySelector(".footer-shell");
  if (!footerShell) return;

  const show = isLastFoldActive(projects);
  footerShell.classList.toggle("is-visible", show);
  document.documentElement.classList.toggle("is-last-fold", show);

  if (show) measureFooterChrome();
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
      : findProjectLandingScrollY(project);
  if (landingY == null) return null;

  project.dataset.landingScrollY = String(landingY);
  return { project, y: landingY };
}

function getFoldContentHeight() {
  return getViewportHeight() - getStickyLine() - getFoldPeek() - getFooterChromeHeight();
}

function getMetaBlockHeight(project = null) {
  if (project) {
    const measured = parseFloat(getComputedStyle(project).getPropertyValue("--meta-block-h"));
    if (Number.isFinite(measured) && measured > 0) return measured;
  }

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

/**
 * Slack under the grid (before the next divider) so a composed sticky header
 * leaves exactly --fold-peek of the next project — same band as hero → 01.
 */
function calibrateFoldSpacing(project, isLast = false) {
  project.style.setProperty("--header-scroll-hold", "0px");

  if (isStackedLayout() || isLast) {
    project.style.setProperty("--project-fold-pad", "0px");
    return 0;
  }

  const metaBlockH = getMetaBlockHeight(project);
  const gridGap = readCssPx("--meta-to-grid-gap", 32);
  const gridH = measureProjectGridHeight(project);
  const foldContentH = getFoldContentHeight();
  const contentH = metaBlockH + gridGap + gridH;
  const pad = Math.max(0, Math.round(foldContentH - contentH));

  project.style.setProperty("--project-fold-pad", `${pad}px`);
  return pad;
}

function calibrateCenteredHold(project) {
  return calibrateFoldSpacing(project, false);
}

function findTabletRuleLandingScrollY(project) {
  const titleRow = project.querySelector(".project__title-row");
  if (!titleRow) return null;

  const textGap = readCssPx("--header-text-gap", 16);
  const stickyLine = getStickyLine();
  const ruleDocY = titleRow.getBoundingClientRect().top - textGap + window.scrollY;
  const approx = ruleDocY - stickyLine;
  const start = Math.max(0, approx - 600);
  const end = Math.min(
    document.documentElement.scrollHeight - 1,
    approx + Math.max(project.offsetHeight, getViewportHeight())
  );

  let firstY = findFirstComposedY(project, start, end);
  if (firstY != null) return firstY;

  // Linear fallback — binary search can miss narrow sticky landing windows.
  let bestY = null;
  let bestDelta = Infinity;

  for (let y = start; y <= end; y += 2) {
    scrollToY(y);
    if (!isTabletRuleLanded(project)) continue;

    const delta = Math.abs(getTabletRuleTop(project) - stickyLine);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestY = y;
    }
  }

  return bestY;
}

function findProjectLandingScrollY(project) {
  return isStackedLayout()
    ? findTabletRuleLandingScrollY(project)
    : findComposedPeekLandingScrollY(project);
}

/** Title locked to sticky AND meta rule composed with it (image-2 top). */
function isDesktopFullyComposed(project) {
  const metrics = getSectionHeaderMetrics(project);
  if (!metrics) return false;

  const stickyLine = getStickyLine();
  return (
    Math.abs(metrics.tcTop - stickyLine) <= HEADER_LAND_TOLERANCE &&
    metrics.composed
  );
}

function findDesktopComposedScrollY(project) {
  const title = project.querySelector(".project__top-content");
  if (!title) return null;

  const approx = project.offsetTop + title.offsetTop - getStickyLine();
  const start = Math.max(0, approx - 500);
  const end = Math.min(
    document.documentElement.scrollHeight - 1,
    approx + Math.max(project.offsetHeight, getViewportHeight())
  );

  scrollToY(start);
  if (isDesktopFullyComposed(project)) return start;

  let lo = start;
  let hi = end;
  let result = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    scrollToY(mid);
    if (isDesktopFullyComposed(project)) {
      result = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  if (result != null) return result;

  for (let y = start; y <= end; y += 2) {
    scrollToY(y);
    if (isDesktopFullyComposed(project)) return y;
  }

  return null;
}

/**
 * Snap to composed sticky header; fold-pad keeps bottom peek at fold-peek.
 */
function findComposedPeekLandingScrollY(project) {
  const projects = [...document.querySelectorAll(".project")];
  const index = projects.indexOf(project);
  const isLast = index >= 0 && index === projects.length - 1;

  if (isLast) {
    return findLastProjectLandingScrollY(project) ?? findDesktopComposedScrollY(project);
  }

  return findDesktopComposedScrollY(project);
}

function findLastProjectLandingScrollY(project) {
  const hold = parseFloat(getComputedStyle(project).getPropertyValue("--header-scroll-hold")) || 0;
  const metaBlockH = getMetaBlockHeight(project);
  const gridGap = readCssPx("--meta-to-grid-gap", 32);
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

    calibrateFoldSpacing(project, true);
    const landingY = findProjectLandingScrollY(project);

    if (landingY != null && landingY <= maxScroll + 1) {
      return;
    }

    pad += deficit > 0 ? Math.ceil(deficit) + 8 : 48;
    if (pad > MAX_PAD) break;
  }
}

/** Remove runway below the terminal landing so the last fold cannot scroll past its snap. */
function trimLastSectionScrollPad(project, landingY) {
  if (!Number.isFinite(landingY)) return;

  const targetScrollHeight = landingY + getViewportHeight();
  let pad = parseFloat(getComputedStyle(project).getPropertyValue("--last-section-scroll-pad")) || 0;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const excess = document.documentElement.scrollHeight - targetScrollHeight;
    if (excess <= 1) break;

    pad = Math.max(0, pad - excess);
    project.style.setProperty("--last-section-scroll-pad", `${pad}px`);
  }
}

function measureFoldHold(projects) {
  if (!projects.length) return;

  const savedY = document.documentElement.classList.contains("is-calibrating") ? 0 : window.scrollY;
  const cachedLandings = [];

  projects.forEach((project, index) => {
    calibrateFoldSpacing(project, index === projects.length - 1);
  });

  projects.forEach((project, index) => {
    const isLastProject = index === projects.length - 1;

    if (isLastProject) {
      ensureLastSectionScrollPad(project);
      calibrateFoldSpacing(project, true);
    }

    // Same title/rule landing as every other section — including the last one.
    // (footerBottom was pulling 08 away from the index snap.)
    const landing = cacheSectionLandingY(project);
    if (landing) {
      if (isLastProject) trimLastSectionScrollPad(project, landing.y);
      cachedLandings.push(landing);
    }
  });

  sectionLandingYs = [{ y: 0 }, ...cachedLandings].sort((a, b) => a.y - b.y);

  window.scrollTo(0, savedY);
  window.dispatchEvent(new Event("scroll"));
}

const FOLD_PEEK_PX = 143;

function measureFooterChrome() {
  const footerShell = document.querySelector(".footer-shell");
  if (!footerShell) {
    document.documentElement.style.setProperty("--footer-chrome-h", "0px");
    return;
  }

  const wasVisible = footerShell.classList.contains("is-visible");
  if (!wasVisible) footerShell.classList.add("is-visible");

  const height = Math.ceil(footerShell.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--footer-chrome-h", `${height}px`);

  if (!wasVisible) footerShell.classList.remove("is-visible");
}

function measureFoldPeek() {
  const viewportH = getViewportHeight();
  document.documentElement.style.setProperty("--viewport-h", `${viewportH}px`);
  measureFooterChrome();
  const bleedRevealed = document.documentElement.classList.contains("hero--bleed");
  document.documentElement.style.setProperty("--fold-peek", bleedRevealed ? `${FOLD_PEEK_PX}px` : "0px");
}

const TILE_ROWS = 3;
const TILE_COLS = 3;
/** Layout test: gray placeholders only (ignore media). Flip off after checking 3×3 @ 16:9. */
const PREVIEW_EMPTY_TILES = false;

const META_ICON_SVGS = {
  person: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.25" r="2" stroke="currentColor" stroke-width="1.25"/><path d="M4.25 13.25c.5-2.25 2.25-3.5 3.75-3.5s3.25 1.25 3.75 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>`,
  bolt: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.25 2.5 5.5 8.25H8l-.75 5.25 4.75-6.5H9.25z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>`,
  chart: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 13.5h11" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M5 10.5 8 7.25 10.5 9 13.5 5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function renderMetaIcon(iconName) {
  return META_ICON_SVGS[iconName] ?? META_ICON_SVGS.person;
}

function renderMetaTags(metadata) {
  const items = metadata.map((item) => {
    if (typeof item === "string") return { icon: null, text: item };
    const raw = item.text ?? item.lines ?? "";
    const text = Array.isArray(raw) ? raw.join(". ") : raw;
    return { icon: item.icon ?? null, text };
  });

  return `<ul class="project__meta-tag-list">
    ${items
      .map(
        ({ icon, text }) => `<li class="project__meta-tag">
        ${icon ? `<span class="project__meta-tag-icon">${renderMetaIcon(icon)}</span>` : ""}
        <span class="project__meta-tag-text">${escapeHtml(text)}</span>
      </li>`,
      )
      .join("")}
  </ul>`;
}

function buildSection(section) {
  const article = document.createElement("article");
  article.className = "project";
  article.id = section.id;

  article.innerHTML = `
    <div class="project__inner">
      <div class="project__meta-shell">
        <header class="project__meta">
          <div class="project__meta-copy${Array.isArray(section.metadata) && section.metadata.length ? " project__meta-copy--three" : ""}">
            <div class="project__meta-desc">
              ${section.description.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
            </div>
            <div class="project__meta-desc">
              ${(section.description2 ?? []).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
            </div>
            ${
              Array.isArray(section.metadata) && section.metadata.length
                ? `<div class="project__meta-desc project__meta-tags">
              ${renderMetaTags(section.metadata)}
            </div>`
                : ""
            }
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
                <h2 class="project__name">${escapeHtml(section.title)}</h2>
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
  if (PREVIEW_EMPTY_TILES) return null;
  return section.media?.[index] ?? null;
}

function resolveMediaType(item) {
  if (!item) return null;
  if (item.type === "gif-grid") return "gif-grid";
  if (!item.src) return null;
  if (item.type === "video") return "video";
  if (item.type === "image") return "image";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(item.src)) return "video";
  return "image";
}

function buildGifGridHtml(media, label) {
  const items = Array.isArray(media.items) ? media.items : [];
  const alt = escapeHtml(media.alt || label);
  const cells = items
    .map((item, i) => {
      const src = escapeHtml(item.src || "");
      const cellAlt = escapeHtml(item.alt || `${label} — gif ${i + 1}`);
      return `<img class="tile-gif-grid__cell" src="${src}" alt="${cellAlt}" loading="lazy" decoding="async">`;
    })
    .join("");

  return `<div class="tile-inner__media tile-gif-grid" role="img" aria-label="${alt}"><div class="tile-gif-grid__inner">${cells}</div></div>`;
}

function buildTileMediaHtml(media, label) {
  if (!media) {
    return '<span class="tile-inner__placeholder" aria-hidden="true"></span>';
  }

  const type = resolveMediaType(media);
  if (type === "gif-grid") {
    return buildGifGridHtml(media, label);
  }

  if (!media.src) {
    return '<span class="tile-inner__placeholder" aria-hidden="true"></span>';
  }

  const src = escapeHtml(media.src);
  const alt = escapeHtml(media.alt || label);

  if (type === "video") {
    const poster = media.poster ? ` poster="${escapeHtml(media.poster)}"` : "";
    return `<video class="tile-inner__media" src="${src}"${poster} autoplay muted loop playsinline preload="metadata" aria-label="${alt}"></video>`;
  }

  return `<img class="tile-inner__media" src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
}

function hasTileMedia(item) {
  if (!item) return false;
  if (item.type === "gif-grid") return Array.isArray(item.items) && item.items.length > 0;
  return Boolean(item.src);
}

function renderTileWrap(index, label, mediaItem) {
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
}

function buildTiles(section) {
  const slotCount = TILE_ROWS * TILE_COLS;
  const filled = Array.isArray(section.media) ? section.media.filter(hasTileMedia) : [];

  // Layout test OR future projects with no media yet → full 3×3 gray placeholders.
  // Projects with some media (e.g. 6) → only those tiles; hide leftover empty grays.
  const items =
    PREVIEW_EMPTY_TILES || filled.length === 0
      ? Array.from({ length: slotCount }, () => null)
      : filled;

  return items
    .map((mediaItem, i) => {
      const index = i + 1;
      const label = `${section.title} — media ${index}`;
      return renderTileWrap(index, label, mediaItem);
    })
    .join("");
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

  const contain = Boolean(tile.closest("#klifra-step"));

  if (source.classList.contains("tile-gif-grid")) {
    const grid = source.cloneNode(true);
    grid.classList.add("lightbox__media", "lightbox__media--contain");
    return grid;
  }

  if (source.tagName === "VIDEO") {
    const video = document.createElement("video");
    video.className = contain ? "lightbox__media lightbox__media--contain" : "lightbox__media";
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
  image.className = contain ? "lightbox__media lightbox__media--contain" : "lightbox__media";
  image.src = source.currentSrc || source.src;
  image.alt = source.alt || "";
  return image;
}

function initTileLightbox(scroll) {
  const lightbox = document.getElementById("lightbox");
  const stage = lightbox?.querySelector(".lightbox__stage");
  const backdrop = lightbox?.querySelector(".lightbox__backdrop");
  const backBtn = lightbox?.querySelector(".lightbox__control--close");
  if (!lightbox || !stage || !backdrop) return;

  const lenis = scroll?.lenis ?? null;
  let activeTile = null;

  /** Tiles in the open project only — never cross into another case study. */
  const projectTiles = () => {
    const project = activeTile?.closest(".project");
    if (!project) return [];
    return [...project.querySelectorAll(".tile-inner")].filter((tile) =>
      tile.querySelector(".tile-inner__media")
    );
  };

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
    const all = projectTiles();
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

  document.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile-inner");
    if (!tile || lightbox.hidden === false) return;
    if (!tile.querySelector(".tile-inner__media")) return;

    event.preventDefault();
    openLightbox(tile);
  });

  backdrop.addEventListener("click", closeLightbox);
  backBtn?.addEventListener("click", closeLightbox);

  lightbox.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  lightbox.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });

  /* Click left half → previous, right half → next (same project loop) */
  stage.addEventListener("click", (event) => {
    event.stopPropagation();
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    stepLightbox(x < rect.width / 2 ? -1 : 1);
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        stepLightbox(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        stepLightbox(-1);
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
