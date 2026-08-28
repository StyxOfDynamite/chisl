/**
 * chisl — analytics (Google Analytics 4)
 *
 * Loads gtag.js and exposes `chisl.track()` for custom events. Kept in one
 * file so the measurement ID lives in exactly one place rather than being
 * duplicated across every page's <head>.
 *
 * MEASUREMENT_ID is live and points at the chisl GA4 property. Localhost
 * traffic is excluded, so developing against the site won't pollute stats.
 *
 * Tracked automatically:
 *   - page_view on every page (gtag does this on config)
 *   - any element carrying data-track="event_name"
 *   - contact form submissions, fired from contact.js
 *
 * Add a tracked element declaratively:
 *   <a href="..." data-track="cta_start_project">Start a project</a>
 */
(function () {
  "use strict";

  var MEASUREMENT_ID = "G-F13K3WC9EW";

  /**
   * Run GA4 without setting any cookies.
   *
   * Flip to true and GA4 loads in Consent Mode with analytics_storage denied:
   * no cookies are written, so no consent banner is needed under UK PECR.
   * The cost is precision — without a client ID, GA can't reliably separate
   * new visitors from returning ones, and user counts become modelled
   * estimates. Pageviews and events still flow.
   *
   * Currently false: full GA4, cookies and all.
   */
  var COOKIELESS = false;

  var chisl = (window.chisl = window.chisl || {});

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var isConfigured = MEASUREMENT_ID !== "G-XXXXXXXXXX";

  // Don't pollute production stats with local development traffic.
  var enabled = isConfigured && !isLocal;

  /* ---------- GA4 name/value rules ---------- */

  // GA4 rejects event names containing anything but letters, digits and
  // underscores, and they must start with a letter. Names are capped at 40
  // characters. Normalising here means call sites can stay readable.
  function safeEventName(name) {
    var cleaned = String(name)
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!/^[A-Za-z]/.test(cleaned)) cleaned = "e_" + cleaned;
    return cleaned.slice(0, 40);
  }

  // Parameter names follow the same rule; values are capped at 100 chars.
  function safeParams(props) {
    var out = {};
    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (value === undefined || value === null) return;
      out[safeEventName(key)] =
        typeof value === "number" || typeof value === "boolean" ? value : String(value).slice(0, 100);
    });
    return out;
  }

  /* ---------- gtag bootstrap ---------- */

  // gtag pushes onto dataLayer, so calls made before the script finishes
  // downloading are still delivered once it does.
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  if (enabled) {
    if (COOKIELESS) {
      // Must be set before config so the very first hit is cookieless.
      gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
    }

    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID, {
      // Trims the last octet of the IP before storage.
      anonymize_ip: true,
      // This is a studio site, not an ad funnel — no advertising signals.
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(script);
  }

  /* ---------- public API ---------- */

  /**
   * Record a custom event. Never throws, and safe to call before gtag.js has
   * loaded or when no measurement ID is configured.
   *
   * @param {string} name  event name, e.g. "contact_submitted"
   * @param {object} [props]  optional string/number/boolean properties
   */
  chisl.track = function (name, props) {
    if (!name) return;

    var eventName = safeEventName(name);
    var params = safeParams(props);

    try {
      if (enabled) {
        window.gtag("event", eventName, params);
      } else if (isLocal) {
        // Makes the instrumentation visible while developing.
        console.debug("[analytics] " + eventName, params);
      }
    } catch (err) {
      // Analytics must never break the page it is measuring.
      if (isLocal) console.debug("[analytics] failed:", err);
    }
  };

  /* ---------- declarative click tracking ---------- */

  // Delegated, so it covers elements added later and needs only one listener.
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target.closest("[data-track]");
      if (!target) return;

      chisl.track(target.getAttribute("data-track"), {
        link_text: (target.textContent || "").trim().slice(0, 60),
        page_path: location.pathname,
      });
    },
    // Capture phase: still records the click if something downstream calls
    // stopPropagation.
    true
  );
})();
