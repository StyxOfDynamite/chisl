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
