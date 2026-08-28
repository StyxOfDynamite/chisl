#!/usr/bin/env python3
"""Local dev server for site/, matching how GitHub Pages actually serves it.

Plain `python3 -m http.server` won't do: the site links to pages without the
.html extension (`/about`, `/gallery`), and GitHub Pages resolves those to
`about.html` on its own. http.server doesn't, so every internal link 404s
locally while working fine in production — a divergence that costs an hour
the first time you hit it.

This adds the one behaviour that's missing: if a path has no extension and
doesn't exist, try `<path>.html` before giving up. It also serves the real
404.html for misses, as Pages does.

Usage:  python3 tools/serve.py [port]     (default 8000)
"""

import functools
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        # Only extensionless paths are candidates — never rewrite /styles.css.
        if not os.path.exists(local) and not os.path.splitext(local)[1]:
            if os.path.isfile(local + ".html"):
                return local + ".html"
        return local

    def send_error(self, code, message=None, explain=None):
        custom = os.path.join(ROOT, "404.html")
        if code == 404 and os.path.isfile(custom):
            self.error_message_format = open(custom, encoding="utf-8").read()
        super().send_error(code, message, explain)

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(PagesHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("", port), handler) as httpd:
        print(f"serving site/ on http://localhost:{port}  (ctrl-c to stop)")
        print("extensionless URLs resolve to .html, as on GitHub Pages")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
