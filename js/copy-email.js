import { trackEmailCopied } from "./analytics.js";

/** Spell UI copy-button pattern — black icons, blur/scale swap (no branding). */
const COPY_BUTTON_MARKUP = `
  <span class="copy-button__layer copy-button__layer--check" aria-hidden="true">
    <svg class="copy-button__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  </span>
  <span class="copy-button__layer copy-button__layer--copy" aria-hidden="true">
    <svg class="copy-button__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  </span>
`;

function ensureCopyButtonMarkup(copyBtn) {
  if (copyBtn.querySelector(".copy-button__layer")) return;
  copyBtn.classList.add("copy-button");
  copyBtn.innerHTML = COPY_BUTTON_MARKUP;
}

/** Bind a copy button to write an email address to the clipboard. */
export function bindCopyEmail(copyBtn, email) {
  if (!copyBtn || !email) return;

  ensureCopyButtonMarkup(copyBtn);

  let resetTimer = null;

  copyBtn.addEventListener("click", async () => {
    if (copyBtn.classList.contains("is-copied")) return;

    try {
      await navigator.clipboard.writeText(email);
      trackEmailCopied();
      copyBtn.classList.add("is-copied");
      copyBtn.disabled = true;
      copyBtn.setAttribute("aria-label", "Copied");

      clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        copyBtn.classList.remove("is-copied");
        copyBtn.disabled = false;
        copyBtn.setAttribute("aria-label", "Copy email address");
      }, 1500);
    } catch {
      copyBtn.setAttribute("aria-label", "Copy failed");
    }
  });
}
