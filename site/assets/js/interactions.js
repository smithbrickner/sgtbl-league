// SGTBL shared interactions: mobile nav, tabs, sortable tables, live countdowns
(function () {
  "use strict";

  // Dark mode toggle — Captain Portal & League Admin only (identified by .admin-topbar; the
  // public site has no such element, so this whole block is a no-op there and never sets
  // data-theme on the public site's pages). Persisted per-browser via localStorage, shared
  // across both portals under one key since it's the same person switching between them.
  var THEME_KEY = "sgtbl-theme";
  var topbar = document.querySelector(".admin-topbar");
  if (topbar) {
    var root = document.documentElement;
    if (localStorage.getItem(THEME_KEY) === "dark") root.setAttribute("data-theme", "dark");

    var themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "btn btn-icon btn-ghost";
    themeBtn.setAttribute("aria-label", "Toggle dark mode");
    themeBtn.innerHTML =
      '<svg class="icon icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
      '<svg class="icon icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" hidden><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';

    function syncThemeIcon() {
      var isDark = root.getAttribute("data-theme") === "dark";
      themeBtn.querySelector(".icon-sun").hidden = isDark;
      themeBtn.querySelector(".icon-moon").hidden = !isDark;
    }
    syncThemeIcon();

    themeBtn.addEventListener("click", function () {
      var goingDark = root.getAttribute("data-theme") !== "dark";
      if (goingDark) root.setAttribute("data-theme", "dark");
      else root.removeAttribute("data-theme");
      localStorage.setItem(THEME_KEY, goingDark ? "dark" : "light");
      syncThemeIcon();
    });

    var notifWrap = topbar.querySelector(".notif-wrap");
    if (notifWrap) topbar.insertBefore(themeBtn, notifWrap);
    else topbar.appendChild(themeBtn);
  }

  // Public site mobile nav toggle
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.querySelector(".site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Admin sidebar toggle
  var adminToggle = document.querySelector(".admin-topbar-toggle");
  var adminShell = document.querySelector(".admin-shell");
  var scrim = document.querySelector(".admin-scrim");
  function closeAdminNav() { if (adminShell) adminShell.classList.remove("nav-open"); }
  if (adminToggle && adminShell) {
    adminToggle.addEventListener("click", function () { adminShell.classList.toggle("nav-open"); });
  }
  if (scrim) scrim.addEventListener("click", closeAdminNav);

  // Notifications dropdown
  var notifBtn = document.getElementById("notifBtn");
  var notifPanel = document.getElementById("notifPanel");
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var opening = notifPanel.hidden;
      notifPanel.hidden = !opening;
      notifBtn.setAttribute("aria-expanded", opening ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!notifPanel.hidden && !notifPanel.contains(e.target) && e.target !== notifBtn) {
        notifPanel.hidden = true;
        notifBtn.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !notifPanel.hidden) {
        notifPanel.hidden = true;
        notifBtn.setAttribute("aria-expanded", "false");
        notifBtn.focus();
      }
    });
  }

  // Tabbar (role=tablist)
  document.querySelectorAll("[data-tabbar]").forEach(function (bar) {
    var buttons = Array.prototype.slice.call(bar.querySelectorAll("button[role=tab]"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) {
          b.setAttribute("aria-selected", "false");
          var panel = document.getElementById(b.getAttribute("aria-controls"));
          if (panel) panel.hidden = true;
        });
        btn.setAttribute("aria-selected", "true");
        var target = document.getElementById(btn.getAttribute("aria-controls"));
        if (target) target.hidden = false;
      });
    });
  });

  // Sortable tables: click a <th aria-sort> to sort tbody rows by data-sort-value on matching cell index
  document.querySelectorAll("table[data-sortable]").forEach(function (table) {
    var headers = Array.prototype.slice.call(table.querySelectorAll("th[aria-sort]"));
    headers.forEach(function (th, idx) {
      th.addEventListener("click", function () {
        var tbody = table.querySelector("tbody");
        var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
        var current = th.getAttribute("aria-sort");
        var dir = current === "descending" ? "ascending" : "descending";
        headers.forEach(function (h) { h.setAttribute("aria-sort", "none"); });
        th.setAttribute("aria-sort", dir);
        var cellIndex = Array.prototype.indexOf.call(th.parentElement.children, th);
        rows.sort(function (a, b) {
          var av = a.children[cellIndex].getAttribute("data-sort-value") || a.children[cellIndex].textContent.trim();
          var bv = b.children[cellIndex].getAttribute("data-sort-value") || b.children[cellIndex].textContent.trim();
          var an = parseFloat(av), bn = parseFloat(bv);
          var cmp;
          if (!isNaN(an) && !isNaN(bn)) cmp = an - bn; else cmp = String(av).localeCompare(String(bv));
          return dir === "ascending" ? cmp : -cmp;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  });

  // Simple text/select filter: elements with [data-filter-input] filter rows in [data-filter-target] by data-filter-text
  document.querySelectorAll("[data-filter-input]").forEach(function (input) {
    var targetSel = input.getAttribute("data-filter-input");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      document.querySelectorAll(targetSel).forEach(function (row) {
        var text = (row.getAttribute("data-filter-text") || row.textContent).toLowerCase();
        row.style.display = text.indexOf(q) === -1 ? "none" : "";
      });
    });
  });

  // Clickable rows: tr[data-href] navigates like a link, incl. keyboard (Enter/Space)
  document.querySelectorAll("tr[data-href]").forEach(function (row) {
    row.setAttribute("role", "link");
    row.addEventListener("click", function () { window.location.href = row.getAttribute("data-href"); });
    row.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = row.getAttribute("data-href"); }
    });
  });

  // Countdown timers: [data-countdown="mm:ss"] ticks down once (visual only, prototype)
  document.querySelectorAll("[data-countdown]").forEach(function (el) {
    var parts = el.getAttribute("data-countdown").split(":");
    var total = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    function render() {
      var m = Math.floor(total / 60), s = total % 60;
      el.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    }
    render();
    var iv = setInterval(function () {
      total -= 1;
      if (total <= 0) { clearInterval(iv); total = 0; }
      render();
    }, 1000);
  });
})();
