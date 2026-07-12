const HERO_CLASS_IDLE = "hero--idle";
const HERO_CLASS_STEP = "hero--step";
const HERO_CLASS_BLEED = "hero--bleed";

export function initHeroIntro(data, scroll, { onStepChange } = {}) {
  const intro = data.site?.intro;
  const hero = document.getElementById("intro");
  if (!intro || !hero) return null;

  const frames = Array.isArray(intro.frames) && intro.frames.length ? intro.frames : [{ alt: "Intro" }];
  const textLines = intro.text ?? data.site?.hero ?? [];
  let step = 0;
  let frameIndex = -1;

  hero.innerHTML = `
    <button type="button" class="hero__hit" aria-label="Continue introduction">
      <div class="hero__inner">
        <div class="hero__stage">
          <div class="hero__media" aria-hidden="true"></div>
          <div class="hero__copy">
            ${textLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
          </div>
        </div>
      </div>
    </button>
  `;

  const hit = hero.querySelector(".hero__hit");
  const media = hero.querySelector(".hero__media");
  const copy = hero.querySelector(".hero__copy");

  const renderFrame = (index) => {
    const frame = frames[index];
    if (!frame || !media) return;

    const src = frame.src ? escapeHtml(frame.src) : "";
    const alt = escapeHtml(frame.alt ?? `Introduction ${index + 1}`);

    media.innerHTML = src
      ? `<img class="hero__media-img" src="${src}" alt="${alt}" decoding="async" />`
      : `<div class="hero__media-placeholder" aria-hidden="true"></div>`;
  };

  const preventScroll = (event) => {
    if (step < 2) {
      event.preventDefault();
    }
  };

  const syncScrollLock = () => {
    const bleed = step >= 2;
    document.documentElement.classList.toggle(HERO_CLASS_BLEED, bleed);
    document.documentElement.classList.toggle(HERO_CLASS_IDLE, step === 0);
    document.documentElement.classList.toggle(HERO_CLASS_STEP, step > 0 && !bleed);

    if (bleed) {
      scroll?.lenis?.start?.();
      document.documentElement.style.overflow = "";
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    } else {
      scroll?.lenis?.stop?.();
      document.documentElement.style.overflow = "hidden";
      window.addEventListener("wheel", preventScroll, { passive: false });
      window.addEventListener("touchmove", preventScroll, { passive: false });
      window.scrollTo(0, 0);
      scroll?.lenis?.scrollTo?.(0, { immediate: true, force: true });
    }

    onStepChange?.();
    window.dispatchEvent(new Event("scroll"));
  };

  const syncUi = () => {
    hero.dataset.step = String(step);
    hero.dataset.frame = frameIndex >= 0 ? String(frameIndex) : "";

    hit.setAttribute(
      "aria-label",
      step === 0 ? "Show introduction" : step === 1 ? "Show next introduction" : "Show next image",
    );

    copy.hidden = step < 1;
    media.hidden = step < 1;

    if (frameIndex >= 0) {
      renderFrame(frameIndex);
    }

    syncScrollLock();
  };

  const advance = () => {
    if (step === 0) {
      step = 1;
      frameIndex = 0;
      syncUi();
      return;
    }

    if (step === 1) {
      step = 2;
      frameIndex = Math.min(1, frames.length - 1);
      syncUi();
      return;
    }

    frameIndex = (frameIndex + 1) % frames.length;
    renderFrame(frameIndex);
    hero.dataset.frame = String(frameIndex);
  };

  hit.addEventListener("click", (event) => {
    event.preventDefault();
    advance();
  });

  document.documentElement.classList.add(HERO_CLASS_IDLE);
  syncUi();

  return {
    getStep: () => step,
    isBleedRevealed: () => step >= 2,
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
