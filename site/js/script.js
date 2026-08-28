/**
 * chisl — shared site behaviour
 *
 * Loaded on every page. Two jobs:
 *   1. The mobile nav toggle (the ☰ button in the header).
 *   2. Filling in the current year in the footer.
 *
 * Everything here degrades safely: if an element isn't on the page,
 * that block is skipped rather than throwing.
 */
(function () {
  "use strict";

  /* ---------- mobile nav ---------- */
  // The stylesheet shows `.nav-links.open` below 760px; above that the
  // toggle is display:none and the links are always visible.
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    var setOpen = function (open) {
      links.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", function () {
      setOpen(!links.classList.contains("open"));
    });

    // Tapping a link navigates; close the panel so it isn't left open
    // behind an in-page anchor jump (e.g. index.html#contact).
    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    // Escape closes the panel and returns focus to the button.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && links.classList.contains("open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    // If the viewport grows past the breakpoint while the panel is open,
    // drop the class so the desktop layout isn't left in the open state.
    if (window.matchMedia) {
      var wide = window.matchMedia("(min-width: 761px)");
      var onChange = function (event) {
        if (event.matches) setOpen(false);
      };
      // addListener is the pre-Safari-14 spelling.
      if (wide.addEventListener) wide.addEventListener("change", onChange);
      else if (wide.addListener) wide.addListener(onChange);
    }
  }

  /* ---------- footer year ---------- */
  var year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = year;
  });
})();
