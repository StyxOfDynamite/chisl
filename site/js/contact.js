/**
 * chisl — contact form submission
 *
 * TO CONNECT YOUR BACKEND:
 *   1. Replace ENDPOINT below with your deployed Lambda Function URL
 *      (or API Gateway endpoint) — see /backend/README.md for setup.
 *   2. Replace RECAPTCHA_SITE_KEY below AND in index.html's script tag
 *      with your real reCAPTCHA v3 site key from
 *      https://www.google.com/recaptcha/admin/create
 *
 * The form runs an invisible reCAPTCHA v3 check on every submit and
 * sends the resulting token to the Lambda, which verifies it server-side
 * before publishing to SNS. This keeps spam submissions from generating
 * SNS charges — bots get rejected before a message is ever published.
 */
(function () {
  const ENDPOINT = "https://REPLACE-ME.lambda-url.us-east-1.on.aws/";
  const RECAPTCHA_SITE_KEY = "RECAPTCHA_SITE_KEY";

  function getRecaptchaToken() {
    return new Promise((resolve, reject) => {
      if (typeof grecaptcha === "undefined") {
        reject(new Error("reCAPTCHA did not load"));
        return;
      }
      grecaptcha.ready(() => {
        grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: "contact_submit" })
          .then(resolve)
          .catch(reject);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;
    const statusEl = form.querySelector("[data-form-status]");
    const submitBtn = form.querySelector("[type=submit]");

    function setStatus(kind, message) {
      statusEl.textContent = message;
      statusEl.className = `form-status show ${kind}`;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (ENDPOINT.includes("REPLACE-ME")) {
        setStatus(
          "err",
          "Contact backend isn't connected yet — deploy the Lambda in /backend and update ENDPOINT in js/contact.js."
        );
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.name || !data.email || !data.phone || !data.message) {
        setStatus("err", "Fill in your name, email, mobile number, and a message before sending.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      try {
        if (RECAPTCHA_SITE_KEY !== "RECAPTCHA_SITE_KEY") {
          data.recaptchaToken = await getRecaptchaToken();
        }

        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        setStatus("ok", "Message sent — we'll get back to you shortly.");
        form.reset();
      } catch (err) {
        setStatus("err", "Something went wrong sending that. Try again, or email us directly.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send message";
      }
    });
  });
})();
