export function initFooter(data) {
  const emailEl = document.getElementById("footer-email");
  const copyBtn = document.getElementById("footer-copy");
  const linkedInEl = document.getElementById("footer-linkedin");
  const email = data.site?.email;
  const linkedIn = data.site?.linkedin;

  if (!emailEl || !email) return;

  emailEl.href = `mailto:${email}`;
  emailEl.textContent = email;

  if (linkedInEl && linkedIn) {
    linkedInEl.href = linkedIn;
    linkedInEl.textContent = "LinkedIn";
  } else if (linkedInEl) {
    linkedInEl.hidden = true;
  }

  if (!copyBtn) return;

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
