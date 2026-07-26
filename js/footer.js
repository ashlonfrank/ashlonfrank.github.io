import { bindCopyEmail } from "./copy-email.js";

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

  bindCopyEmail(copyBtn, email);
}
