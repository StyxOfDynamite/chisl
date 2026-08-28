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

## Deploying

The site deploys itself: every push to `main` that touches `site/**` triggers
`.github/workflows/deploy.yml`, which publishes `site/` to GitHub Pages. Watch
the **Actions** tab for progress. You can also trigger a deploy by hand from
that tab via **Run workflow**.

Two one-time setup steps on the repo:

1. **Settings → Pages → Build and deployment → Source →** select **GitHub Actions**.
2. **Settings → Pages → Custom domain →** enter `chisl.io`, and tick
   **Enforce HTTPS** once the certificate finishes provisioning.

And point the domain at GitHub Pages in your DNS — apex `A` records to
`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`,
plus a `CNAME` for `www` to `StyxOfDynamite.github.io`.

## Before it's fully production-ready

- [ ] **Deploy the contact form backend** — see [`backend/README.md`](backend/README.md)
      (SNS topic, Lambda, reCAPTCHA), then replace `ENDPOINT` and
      `RECAPTCHA_SITE_KEY` in `site/js/contact.js` and the reCAPTCHA script tag
      in `site/index.html`. **Until this is done the form fails on submit.**
- [ ] **Replace the placeholder business details** in the JSON-LD at the top of
      `site/index.html`, `site/about.html`, and `site/gallery.html` — the
      address (`123 Workshop Lane`), phone (`+1-555-010-0100`), and the
      `sameAs` GitHub link are all fake. Inaccurate `LocalBusiness` data can
      hurt local search ranking. Search for `TODO`.
- [ ] **Swap the placeholder testimonial** on the homepage
      (`site/index.html`, `#testimonial`) for a real one.
- [ ] **Add the Open Graph image** — every page points at
      `https://chisl.io/images/og-cover.jpg`, which doesn't exist yet.
      It should be 1200×630.
