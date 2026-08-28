# chisl

A web development studio site, plus the serverless contact-form backend.
Lives at **https://chisl.io/**.

```
chisl/
├── site/                   # the static site — deployed to GitHub Pages
│   ├── index.html
│   ├── about.html
│   ├── gallery.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── script.js       # nav toggle, footer year (all pages)
│   │   ├── analytics.js    # GA4 loader + event tracking (all pages)
│   │   ├── github-widget.js # "Shop floor" activity panel (home only)
│   │   └── contact.js      # contact form submit + reCAPTCHA (home only)
│   ├── CNAME               # custom domain for Pages
│   ├── robots.txt
│   └── sitemap.xml
├── backend/                # Lambda that publishes contact form submissions to SNS
│   ├── index.mjs
│   ├── package.json
│   └── README.md           # full deployment steps (SNS, Lambda, reCAPTCHA)
└── .github/workflows/
    └── deploy.yml          # auto-deploys site/ to GitHub Pages on push
```

No build step — `site/` is plain HTML/CSS/JS and gets published as-is.

## Working on it locally

```bash
python3 -m http.server 8000 --directory site
```

Then open <http://localhost:8000>. The GitHub activity widget works locally
(it's a public API); the contact form won't until the backend is deployed.
Analytics deliberately does nothing on `localhost` — events are logged to the
console instead of being sent, so local browsing never lands in the reports.

## Analytics

Google Analytics 4, loaded from [`site/js/analytics.js`](site/js/analytics.js).
The measurement ID lives in that one file rather than in each page's `<head>`.

**Setup:** create a GA4 property, then copy the measurement ID from
**Admin → Data streams → (your web stream) → Measurement ID** (format
`G-XXXXXXXXXX`) into `MEASUREMENT_ID` at the top of `analytics.js`. Until
that's replaced the file no-ops, so nothing breaks before it's configured.

Events currently tracked:

| Event | Fires when | Parameters |
| --- | --- | --- |
| `page_view` | every page load | standard GA4 |
| `cta_nav_start_project` | "Start a Project" clicked in the nav | `link_text`, `page_path` |
| `cta_hero_start_project` | "Start a project" clicked in the hero | `link_text`, `page_path` |
| `contact_submitted` | form submits successfully | `project_type` |
| `contact_failed` | submit reaches the backend and fails | `reason` |

To track something new, add `data-track="event_name"` to any element — a
delegated listener picks it up, no JS change needed. From code, call
`window.chisl.track("event_name", { param: "value" })`. Names are normalised
to GA4's rules automatically (letters, digits and underscores only, must start
with a letter, 40 chars max), and parameter values are truncated to 100 chars.

Google Signals and ad personalisation are both disabled, and `anonymize_ip` is
on — this is traffic measurement, not an ad funnel.

> **Cookie consent.** GA4 sets cookies, which under UK PECR requires consent
> before they're set. This site currently runs GA4 without a consent banner —
> a deliberate choice. If you later want to remove that exposure, flip
> `COOKIELESS = true` in `analytics.js`: GA4 then loads in Consent Mode with
> `analytics_storage` denied, sets no cookies, and needs no banner. The cost is
> precision — new-vs-returning visitor counts become modelled estimates.

## Deploying

The site deploys itself: every push to `main` that touches `site/**` triggers
`.github/workflows/deploy.yml`, which publishes `site/` to GitHub Pages. Watch
the **Actions** tab for progress. You can also trigger a deploy by hand from
that tab via **Run workflow**.

## Attaching the chisl.io domain

The site currently serves from `https://StyxOfDynamite.github.io/chisl/`. The
custom domain isn't attached yet because `chisl.io` still points at the
registrar's parking IP — attaching it before DNS is ready would make the site
unreachable, since Pages redirects the `github.io` URL to the custom domain.

Order matters:

1. **Update DNS at Namecheap** (`chisl.io` → Advanced DNS). Four apex `A`
   records for `@`:

   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   Plus a `CNAME` for `www` → `StyxOfDynamite.github.io`.

2. **Wait for propagation** — check with `dig +short chisl.io A` until the
   GitHub IPs come back.

3. **Add the CNAME file back** and push:

   ```bash
   echo "chisl.io" > site/CNAME
   git add site/CNAME && git commit -m "Attach chisl.io custom domain" && git push
   ```

4. **Tick Enforce HTTPS** in Settings → Pages once the certificate provisions
   (usually a few minutes, occasionally up to an hour).

All the canonical/`og:url`/sitemap URLs already say `https://chisl.io/`, so no
other change is needed when the domain lands.

## Before it's fully production-ready

- [ ] **Deploy the contact form backend** — see [`backend/README.md`](backend/README.md)
      (SNS topic, Lambda, reCAPTCHA), then replace `ENDPOINT` and
      `RECAPTCHA_SITE_KEY` in `site/js/contact.js` and the reCAPTCHA script tag
      in `site/index.html`. **Until this is done the form fails on submit.**
- [ ] **Set the GA4 measurement ID** — replace `MEASUREMENT_ID` in
      `site/js/analytics.js` with the ID from your GA4 property. Until then no
      analytics are collected at all. See [Analytics](#analytics) above.
- [x] ~~Replace the placeholder business details in the JSON-LD~~ — done; all
      three pages now carry the real Wigston / Leicestershire address and the
      `sameAs` GitHub link.
- [ ] **Swap the placeholder testimonial** on the homepage
      (`site/index.html`, `#testimonial`) for a real one.
- [ ] **Add the Open Graph image** — every page points at
      `https://chisl.io/images/og-cover.jpg`, which doesn't exist yet.
      It should be 1200×630.
