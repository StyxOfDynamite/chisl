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
│   ├── images/og-cover.jpg # Open Graph card (1200×630)
│   ├── CNAME               # custom domain for Pages — see the domain section
│   ├── robots.txt
│   └── sitemap.xml
├── backend/                # Lambda that publishes contact form submissions to SNS
│   ├── index.mjs
│   ├── package.json
│   ├── set-recaptcha-secret.sh  # merges the reCAPTCHA secret into the Lambda env
│   └── README.md           # full deployment steps (SNS, Lambda, reCAPTCHA)
├── tools/
│   ├── serve.py            # local dev server — matches how Pages serves the site
│   └── og-cover.py         # regenerates site/images/og-cover.jpg (deterministic)
└── .github/workflows/
    └── deploy.yml          # auto-deploys site/ to GitHub Pages on push
```

No build step — `site/` is plain HTML/CSS/JS and gets published as-is.

## Working on it locally

```bash
python3 tools/serve.py
```

Then open <http://localhost:8000>. The GitHub activity widget works locally
(it's a public API). The contact form does not: the backend's `ALLOWED_ORIGIN`
allowlist covers `chisl.io` and the `github.io` URL, so a submit from
`localhost` is refused by CORS. Add `http://localhost:8000` to that variable
temporarily if you need to exercise the form end to end.

> Use `tools/serve.py`, not plain `python3 -m http.server`. Pages are linked
> without the `.html` extension (`/about`, `/gallery`) — GitHub Pages resolves
> those to `about.html` automatically, but `http.server` doesn't, so every
> internal link 404s locally while working fine in production. The script adds
> that one fallback and nothing else.

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

**The backend does not.** Nothing watches `backend/**`, so a change to
`index.mjs` sits in the repo until you push it by hand:

```bash
cd backend && npm run package
aws lambda update-function-code --function-name chisl-contact \
  --zip-file fileb://function.zip --region eu-west-2 --profile chisl
```

Full details, including which AWS profile to use, are in
[`backend/README.md`](backend/README.md).

## The chisl.io domain

Attached and live. `https://chisl.io/` serves the site, HTTPS is enforced
(plain `http://` 301s to it), and `https://www.chisl.io/` 301s to the apex.
The `github.io` URL also redirects to the apex, which is normal Pages
behaviour once a custom domain is set.

The pieces holding it together, in case any of them need checking:

| Piece | Value |
| --- | --- |
| `site/CNAME` | `chisl.io` — this is what tells Pages the custom domain |
| Apex `A` records (Namecheap → Advanced DNS) | `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| `www` | redirects to the apex |
| Settings → Pages | **Enforce HTTPS** ticked |

Verify DNS at any time with `dig +short chisl.io A` — it should return those
four GitHub IPs.

> Deleting `site/CNAME` detaches the domain and the site drops back to the
> `github.io` URL. Every canonical, `og:url` and sitemap entry is an absolute
> `https://chisl.io/...` URL, so they'd all point somewhere unreachable until
> the file came back. It's one file, and it matters more than its size suggests.

## Status

Everything on the original launch list is done and live:

- **Contact form backend** — deployed and taking submissions. `ENDPOINT` and
  `RECAPTCHA_SITE_KEY` are set in `site/js/contact.js`, and the reCAPTCHA
  script tag in `site/index.html` carries the real site key. A POST without a
  token returns `400 {"error":"Missing spam-check token"}`, which is the quick
  way to confirm the whole path is alive.
- **GA4** — measurement ID set in `site/js/analytics.js`. See
  [Analytics](#analytics).
- **JSON-LD** — all three pages carry the real Wigston / Leicestershire
  address and the `sameAs` GitHub link.
- **Testimonial** — the homepage quote is a real, signed-off one from Charles
  at CJP Motorcycles.
- **Open Graph image** — `site/images/og-cover.jpg` exists at 1200×630.
  Regenerate with `python3 tools/og-cover.py`; it's seeded, so the output is
  byte-identical each run.

### Known gap: no phone notifications

Contact form submissions arrive by **email only**. SMS was wired up and then
removed — UK carriers only deliver alphanumeric sender IDs that are registered
with them, the account's wasn't, and there was no origination number to fall
back on, so every text failed at the network while email was unaffected.
Un-breaking it needs a sender ID registration *and* an AWS Support case to
leave the SMS sandbox and lift the $1/month spend cap.

If you want something that buzzes a phone, a Telegram bot or a Pushover
webhook called from the Lambda is far less work than reviving SMS: no
registration, no carrier, no per-message cost. There's a `fetch` in
`backend/index.mjs` already (reCAPTCHA uses it), so it's a handful of lines
plus two environment variables.
