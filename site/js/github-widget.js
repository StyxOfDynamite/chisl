/**
 * chisl — "Shop floor" activity widget
 *
 * Fills [data-github-widget] with recent public GitHub activity: a 14-day
 * commit tally and a ledger of the latest events.
 *
 * Uses the unauthenticated events API, which is rate-limited to 60 requests
 * per hour per IP and only returns roughly the last 90 days / 300 events.
 * That's deliberate — no token ships to the browser. If the request fails
 * or the account has been quiet, the panel says so rather than sitting on
 * "Loading activity…" forever.
 */
(function () {
  "use strict";

  var USER = "StyxOfDynamite";
  var DAYS = 14; // number of bars in the tally
  var LEDGER_MAX = 6; // rows shown under the tally

  var bench = document.querySelector("[data-github-widget]");
  if (!bench) return;

  /* ---------- small helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    // textContent, never innerHTML — repo names come from the API.
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function relativeTime(iso) {
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "just now";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.round(hours / 24);
    if (days < 7) return days + "d ago";
    var weeks = Math.round(days / 7);
    if (weeks < 5) return weeks + "w ago";
    return Math.round(days / 30) + "mo ago";
  }

  // The event types worth surfacing, mapped to shop-floor language.
  var KINDS = {
    PushEvent: "commit",
    CreateEvent: "branch",
    PullRequestEvent: "pull request",
    IssuesEvent: "issue",
    ReleaseEvent: "release",
    IssueCommentEvent: "comment",
    ForkEvent: "fork",
    WatchEvent: "star",
  };

  function shortRepo(name) {
    // "StyxOfDynamite/chisl" -> "chisl"
    var slash = name.indexOf("/");
    return slash === -1 ? name : name.slice(slash + 1);
  }

  /* ---------- rendering ---------- */

  function renderHead(isLive, statusText) {
    var head = el("div", "bench-head");
    head.appendChild(el("h3", null, "Recent activity"));

    var status = el("span", "bench-status");
    status.appendChild(el("span", isLive ? "dot live" : "dot"));
    status.appendChild(document.createTextNode(statusText));
    head.appendChild(status);

    return head;
  }

  // Buckets commits into one bar per day, oldest on the left.
  function renderTally(events) {
    var counts = new Array(DAYS).fill(0);
    var today = startOfDay(new Date()).getTime();
    var dayMs = 86400000;

    events.forEach(function (event) {
      if (event.type !== "PushEvent") return;
      var day = startOfDay(new Date(event.created_at)).getTime();
      var index = DAYS - 1 - Math.round((today - day) / dayMs);
      if (index >= 0 && index < DAYS) {
        counts[index] += (event.payload && event.payload.size) || 1;
      }
    });

    var peak = Math.max.apply(null, counts);
    var tally = el("div", "tally");

    counts.forEach(function (count, index) {
      var bar = el("span", "cut");
      // Keep a visible sliver on zero days so the row reads as a timeline.
      bar.style.height = peak > 0 ? Math.max(6, (count / peak) * 100) + "%" : "6%";
      var daysAgo = DAYS - 1 - index;
      bar.title =
        count +
        (count === 1 ? " commit " : " commits ") +
        (daysAgo === 0 ? "today" : daysAgo + " day" + (daysAgo === 1 ? "" : "s") + " ago");
      tally.appendChild(bar);
    });

    var labels = el("div", "tally-labels");
    labels.appendChild(el("span", null, DAYS + " days ago"));
    labels.appendChild(el("span", null, "today"));

    return { tally: tally, labels: labels, total: counts.reduce(function (a, b) { return a + b; }, 0) };
  }

  function renderLedger(events) {
    var ledger = el("ul", "ledger");
    var shown = 0;

    for (var i = 0; i < events.length && shown < LEDGER_MAX; i++) {
      var event = events[i];
      var kind = KINDS[event.type];
      if (!kind) continue;

      var row = el("li");
      row.appendChild(el("span", "repo", shortRepo(event.repo.name)));
      row.appendChild(el("span", "kind", kind));
      row.appendChild(el("span", "when", relativeTime(event.created_at)));
      ledger.appendChild(row);
      shown++;
    }

    return shown > 0 ? ledger : null;
  }

  // Replaces the "Loading activity…" placeholder in one shot.
  function paint(nodes) {
    bench.textContent = "";
    nodes.forEach(function (node) {
      if (node) bench.appendChild(node);
    });
  }

  function renderQuiet(message) {
    paint([renderHead(false, "idle"), el("p", "bench-note", message)]);
  }

  // Fallback ledger: most-recently-pushed public repos, newest first.
  // Forks are skipped — they're someone else's work, not ours.
  function renderRepoLedger(repos) {
    var ledger = el("ul", "ledger");
    var shown = 0;

    for (var i = 0; i < repos.length && shown < LEDGER_MAX; i++) {
      var repo = repos[i];
      if (repo.fork || !repo.pushed_at) continue;

      var row = el("li");
      row.appendChild(el("span", "repo", repo.name));
      row.appendChild(el("span", "kind", repo.language || "project"));
      row.appendChild(el("span", "when", relativeTime(repo.pushed_at)));
      ledger.appendChild(row);
      shown++;
    }

    return shown > 0 ? ledger : null;
  }

  /* ---------- fetch ---------- */

  function getJSON(path) {
    return fetch("https://api.github.com" + path, {
      headers: { Accept: "application/vnd.github+json" },
    }).then(function (response) {
      if (!response.ok) throw new Error("GitHub API responded " + response.status);
      return response.json();
    });
  }

  // The events endpoint only reports activity on *public* repos, so a stretch
  // of private work reads as silence. When that happens, fall back to the
  // public repo list so the panel still shows something real.
  function showRepoFallback() {
    return getJSON("/users/" + USER + "/repos?sort=pushed&per_page=100").then(function (repos) {
      if (!Array.isArray(repos)) throw new Error("Unexpected repos payload");

      var ledger = renderRepoLedger(repos);
      if (!ledger) {
        renderQuiet("No public activity to show right now.");
        return;
      }

      paint([
        renderHead(true, "latest work"),
        ledger,
        el("p", "bench-note", "Most recently updated public repositories. Private client work isn't listed."),
      ]);
    });
  }

  getJSON("/users/" + USER + "/events/public?per_page=100")
    .then(function (events) {
      if (!Array.isArray(events) || events.length === 0) return showRepoFallback();

      var tallied = renderTally(events);
      var ledger = renderLedger(events);

      // Events exist but none are recent or renderable — the repo list is
      // more informative than an empty tally.
      if (tallied.total === 0 && !ledger) return showRepoFallback();

      paint([
        renderHead(
          tallied.total > 0,
          tallied.total > 0
            ? tallied.total + (tallied.total === 1 ? " commit" : " commits") + " / " + DAYS + " days"
            : "quiet fortnight"
        ),
        tallied.tally,
        tallied.labels,
        ledger,
        el("p", "bench-note", "Live from the public GitHub API — updates when we push."),
      ]);
    })
    .catch(function () {
      // Most likely the unauthenticated rate limit, or the visitor is offline.
      renderQuiet("Activity feed unavailable right now — check back shortly.");
    });
})();
