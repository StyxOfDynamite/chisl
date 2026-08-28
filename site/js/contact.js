/**
 * chisl — contact form submission
 *
 * ENDPOINT is live: an API Gateway HTTP API in front of the chisl-contact
 * Lambda in eu-west-2. (Lambda Function URLs are blocked from anonymous
 * invocation on this AWS account, so API Gateway fronts it instead — see
 * /backend/README.md.)
 *
 * RECAPTCHA_SITE_KEY is the real v3 site key, and matches the one in
 * index.html's script tag. Site keys are public by design — the secret half
 * lives only in the Lambda's RECAPTCHA_SECRET environment variable.
 *
 * The form runs an invisible reCAPTCHA v3 check on every submit and
 * sends the resulting token to the Lambda, which verifies it server-side
 * before publishing to SNS. This keeps spam submissions from generating
 * SNS charges — bots get rejected before a message is ever published.
 */
(function () {
  const ENDPOINT = "https://dngcc8ftia.execute-api.eu-west-2.amazonaws.com/";
  const RECAPTCHA_SITE_KEY = "6Lfftp0tAAAAACv6UYDCGWQ0KlnfiiL8AlfFdE-X";

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
        // Conversion event. Deliberately after the success check, so only
        // messages that actually reached the backend get counted.
        window.chisl?.track("contact_submitted", { project_type: data.projectType || "unspecified" });
        form.reset();
      } catch (err) {
        setStatus("err", "Something went wrong sending that. Try again, or email us directly.");
        window.chisl?.track("contact_failed", { reason: String(err.message || err).slice(0, 80) });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send message";
      }
    });
  });
})();
