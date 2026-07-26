/** Bind a copy button to write an email address to the clipboard. */
export function bindCopyEmail(copyBtn, email) {
  if (!copyBtn || !email) return;

  let resetTimer = null;

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      copyBtn.classList.add("is-copied");
      copyBtn.setAttribute("aria-label", "Email copied");

      clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        copyBtn.classList.remove("is-copied");
        copyBtn.setAttribute("aria-label", "Copy email address");
      }, 1800);
    } catch {
      copyBtn.setAttribute("aria-label", "Copy failed");
    }
  });
}
