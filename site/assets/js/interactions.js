// SGTBL shared interactions: mobile nav, tabs, sortable tables, live countdowns
(function () {
  "use strict";

  // Dark mode toggle — every page: portals put it in the .admin-topbar, the public site in the
  // .site-nav's .nav-actions (before the mobile menu button). Persisted per-browser via
  // localStorage under one key, so the choice carries across the public site and both portals.
  var THEME_KEY = "sgtbl-theme";
  var topbar = document.querySelector(".admin-topbar");
  var publicActions = document.querySelector(".site-nav .nav-actions");
  if (topbar || publicActions) {
    var root = document.documentElement;
    var storedTheme = null;
    try { storedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (storedTheme === "dark") root.setAttribute("data-theme", "dark");

    var themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "btn btn-icon btn-ghost theme-toggle";
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
      try { localStorage.setItem(THEME_KEY, goingDark ? "dark" : "light"); } catch (e) {}
      syncThemeIcon();
    });

    if (topbar) {
      var notifWrap = topbar.querySelector(".notif-wrap");
      if (notifWrap) topbar.insertBefore(themeBtn, notifWrap);
      else topbar.appendChild(themeBtn);
    } else {
      var mobileToggle = publicActions.querySelector(".nav-toggle");
      if (mobileToggle) publicActions.insertBefore(themeBtn, mobileToggle);
      else publicActions.appendChild(themeBtn);
    }
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

  // Shot chart — shaded court zones + clickable make/miss dots. (A KDE-grid heat map was tried on
  // 2026-11-15 and reverted at the user's request — keep the zones.)
  // [data-spray-chart] holds a <script type="application/json"> with { zones: { <zoneId>: { fgm, fga, lg } } }.
  // 1) Individual shots are generated deterministically (seeded by the player's name) inside each zone,
  //    exactly fga per zone with exactly fgm makes, so the zone table and totals still reconcile.
  // 2) Each of the 12 zones is shaded by its FG% minus league-average FG% from that zone.
  //    Bins in pct points: <= -9 cold-3 | -9..-5 cold-2 | -5..-2 cold-1 | -2..+2 even | +2..+5 hot-1 | +5..+9 hot-2 | >= +9 hot-3
  // 3) Every shot is a dot (white = make, X = miss) wrapped in a link to its film clip: the Team Portal
  //    passes data-film-href="film-room.html" (opens the Film Room on that shot); pages without a Film
  //    Room (public site, League Admin) play the clip in a pop-up instead.
  var CLIP_VIDEOS = ["mQPbdoRZYY8", "D8xitFa57NI", "rsHQ96CLq70"]; // placeholder film, same clips the Film Room uses
  var SHOT_STORE = {}; // player name -> generated shots, shared with the Film Room tab's play library
  // Real game film (SportsVisio MP4 clips) is only ever loaded from this host
  var REAL_CLIP_RE = /^https:\/\/api\.sportsvisio-api\.com\/media\/[0-9a-f\/-]+\/clip\.mp4$/;
  // SportsVisio clip start times are video timecodes "HH:MM:SS:FF" -> "MM:SS" (or "H:MM:SS")
  function filmTime(tc) {
    var p = String(tc || "").split(":"); if (p.length < 3) return tc || "";
    var h = +p[0], m = p[1], s = p[2];
    return (h ? h + ":" + m : String(+m)) + ":" + s;
  }
  var clipDialog = null;
  function openClipDialog(shot) {
    if (!clipDialog) {
      clipDialog = document.createElement("dialog");
      clipDialog.className = "clip-dialog";
      clipDialog.innerHTML =
        '<div class="clip-head"><div><strong data-clip-title></strong><div class="muted" data-clip-meta></div></div>' +
        '<button type="button" class="btn btn-icon btn-ghost" data-clip-close aria-label="Close clip">&#10005;</button></div>' +
        '<div class="clip-frame"><iframe title="Shot clip" allow="autoplay; encrypted-media" allowfullscreen></iframe>' +
        '<video controls playsinline preload="metadata" hidden></video></div>' +
        '<p class="muted clip-note" data-clip-note></p>';
      document.body.appendChild(clipDialog);
      clipDialog.querySelector("[data-clip-close]").addEventListener("click", function () { clipDialog.close(); });
      clipDialog.addEventListener("click", function (e) { if (e.target === clipDialog) clipDialog.close(); });
      clipDialog.addEventListener("close", function () {
        clipDialog.querySelector("iframe").src = "about:blank";
        var v = clipDialog.querySelector("video"); v.pause(); v.removeAttribute("src"); v.load();
      });
    }
    clipDialog.querySelector("[data-clip-title]").textContent = shot.title;
    clipDialog.querySelector("[data-clip-meta]").textContent = shot.meta;
    var frame = clipDialog.querySelector("iframe"), video = clipDialog.querySelector("video"), note = clipDialog.querySelector("[data-clip-note]");
    if (shot.src && REAL_CLIP_RE.test(shot.src)) {          // real game film
      frame.hidden = true; frame.src = "about:blank";
      video.hidden = false; video.src = shot.src; video.play().catch(function () {});
      note.textContent = "Game film from SportsVisio.";
    } else {                                                 // placeholder YouTube film
      video.hidden = true; video.removeAttribute("src");
      frame.hidden = false; frame.src = "https://www.youtube.com/embed/" + shot.video + "?start=" + shot.start + "&autoplay=1";
      note.textContent = "Placeholder film for the prototype — each shot links to its own tagged clip once game film is synced.";
    }
    if (clipDialog.showModal) clipDialog.showModal(); else clipDialog.setAttribute("open", "");
  }

  document.querySelectorAll("[data-spray-chart]").forEach(function (host) {
    var src = host.querySelector('script[type="application/json"]');
    if (!src) return;
    var data = JSON.parse(src.textContent);
    var NS = "http://www.w3.org/2000/svg";
    var HX = 250, HY = 52.5;            // hoop centre; court is 500x350 (10px = 1ft), baseline at top
    var player = host.getAttribute("data-player") || "Player";
    var filmHref = host.getAttribute("data-film-href");

    // Zone geometry: region x angular wedge from the hoop (0deg = +x, 90deg = toward half court)
    var ZONES = [
      { id: "ra",       name: "Restricted Area",    region: "ra",    a: [-90, 270] },
      { id: "paint",    name: "Paint (Non-RA)",     region: "paint", a: [-90, 270] },
      { id: "midLBase", name: "Left Baseline Mid",  region: "mid",   a: [150, 270] },
      { id: "midLElb",  name: "Left Elbow Mid",     region: "mid",   a: [110, 150] },
      { id: "midTop",   name: "Top of Key Mid",     region: "mid",   a: [70, 110] },
      { id: "midRElb",  name: "Right Elbow Mid",    region: "mid",   a: [30, 70] },
      { id: "midRBase", name: "Right Baseline Mid", region: "mid",   a: [-90, 30] },
      { id: "c3L",      name: "Left Corner 3",      region: "three", a: [158, 270] },
      { id: "w3L",      name: "Left Wing 3",        region: "three", a: [112, 158] },
      { id: "t3",       name: "Top of Key 3",       region: "three", a: [68, 112] },
      { id: "w3R",      name: "Right Wing 3",       region: "three", a: [22, 68] },
      { id: "c3R",      name: "Right Corner 3",     region: "three", a: [-90, 22] }
    ];
    var RADIUS = { ra: [4, 36], paint: [42, 145], mid: [70, 232], three: [240, 272] };

    function el(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }
    function bin(d) {
      if (d <= -9) return "cold-3"; if (d <= -5) return "cold-2"; if (d <= -2) return "cold-1";
      if (d < 2) return "even"; if (d < 5) return "hot-1"; if (d < 9) return "hot-2"; return "hot-3";
    }
    function pct(m, a) { return a ? (100 * m / a) : 0; }
    function dist(x, y) { return Math.sqrt((x - HX) * (x - HX) + (y - HY) * (y - HY)); }
    function angle(x, y) { var a = Math.atan2(y - HY, x - HX) * 180 / Math.PI; return a < -90 ? a + 360 : a; }
    function regionOf(x, y) {
      if ((x >= 210 && x <= 290 && y <= HY) || (y > HY && dist(x, y) <= 40)) return "ra";
      if (x >= 170 && x <= 330 && y <= 190) return "paint";
      if ((x >= 30 && x <= 470 && y <= 142) || dist(x, y) <= 237.5) return "mid";
      return "three";
    }
    function zoneOf(x, y) {
      var r = regionOf(x, y), a = angle(x, y);
      for (var i = 0; i < ZONES.length; i++) if (ZONES[i].region === r && a >= ZONES[i].a[0] && a < ZONES[i].a[1]) return ZONES[i];
      return null;
    }
    function seededRandom(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return function () {
        h = (h + 0x6D2B79F5) | 0;
        var t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    // Games (and any real game-film clips) come from the page's trend chart data when present
    var games = [], realClips = null;
    var trendSrc = document.querySelector('[data-trend-chart] script[type="application/json"]');
    if (trendSrc) { try { var td = JSON.parse(trendSrc.textContent); games = td.games || []; realClips = td.clips || null; } catch (e) {} }

    // --- 1) generate shots ---
    var rand = seededRandom(player + "|shots");
    var shots = [], rows = [];
    ZONES.forEach(function (z) {
      var s = data.zones[z.id]; if (!s) return;
      var fg = pct(s.fgm, s.fga), diff = fg - s.lg;
      rows.push({ z: z, s: s, fg: fg, diff: diff, b: bin(diff) });
      var order = [];
      for (var i = 0; i < s.fga; i++) order.push(i);
      for (i = order.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
      var rr = RADIUS[z.region];
      for (i = 0; i < s.fga; i++) {
        var x = HX, y = HY + 20, tries = 0;
        do {
          var a = (z.a[0] + rand() * (z.a[1] - z.a[0])) * Math.PI / 180, r = rr[0] + rand() * (rr[1] - rr[0]);
          x = HX + r * Math.cos(a); y = HY + r * Math.sin(a); tries++;
        } while (tries < 400 && (x < 5 || x > 495 || y < 5 || y > 345 || zoneOf(x, y) !== z));
        var g = games.length ? games[Math.floor(rand() * games.length)] : null;
        var half = rand() < 0.5 ? "1H" : "2H", secs = Math.floor(rand() * 1200);
        var clock = Math.floor(secs / 60) + ":" + ("0" + (secs % 60)).slice(-2);
        var made = order[i] < s.fgm;
        var kind = z.region === "three" ? "3PT" : "2PT";
        var n = shots.length + 1;
        shots.push({
          id: "S" + ("00" + n).slice(-3), x: x, y: y, made: made, lg: s.lg, zone: z, kind: kind, half: half, clock: clock,
          gameIdx: g ? games.indexOf(g) : -1, sortKey: (half === "2H" ? 1200 : 0) + (1200 - secs),
          title: player + " — " + (made ? "Made " : "Missed ") + kind + ", " + z.name,
          meta: (g ? g.date + " " + g.opp + " · " : "") + half + " " + clock,
          video: CLIP_VIDEOS[n % CLIP_VIDEOS.length], start: 5 + Math.floor(rand() * 240)
        });
      }
    });

    // Tie every shot to a game so each game's makes/misses match its box score (FGM/FGA/TPM/TPA in the
    // game data): made threes go to games in proportion to that game's 3PM, missed twos to its 2PA-2PM, etc.
    if (games.length && games[0].FGA != null) {
      var slots = { "3PT|1": [], "3PT|0": [], "2PT|1": [], "2PT|0": [] };
      games.forEach(function (gm, gi) {
        function add(k, c) { for (var q = 0; q < c; q++) slots[k].push(gi); }
        add("3PT|1", gm.TPM); add("3PT|0", gm.TPA - gm.TPM);
        add("2PT|1", gm.FGM - gm.TPM); add("2PT|0", (gm.FGA - gm.TPA) - (gm.FGM - gm.TPM));
      });
      Object.keys(slots).forEach(function (k) {
        var arr = slots[k];
        for (var q = arr.length - 1; q > 0; q--) { var j = Math.floor(rand() * (q + 1)), tmp = arr[q]; arr[q] = arr[j]; arr[j] = tmp; }
      });
      shots.forEach(function (sh) {
        var gi = slots[sh.kind + "|" + (sh.made ? 1 : 0)].pop();
        if (gi == null) return;
        sh.gameIdx = gi; sh.meta = games[gi].date + " " + games[gi].opp + " · " + sh.half + " " + sh.clock;
      });
    }

    // Real game film: when the page data has SportsVisio clips, each shot takes a real clip from the same game,
    // shot type and result (make/miss), in film order. Shots without one (untagged makes/misses) aren't clickable.
    // Shot LOCATIONS are still estimated - SportsVisio doesn't publish them - only the makes/attempts are real.
    if (realClips) {
      var pool = {};
      realClips.slice().sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; })
        .forEach(function (c) { var k = c.game + "|" + c.kind + "|" + (c.made !== false); (pool[k] = pool[k] || []).push(c); });
      shots.forEach(function (sh) {
        sh.clipless = true;
        if (sh.gameIdx < 0) return;
        var list = pool[sh.gameIdx + "|" + sh.kind + "|" + !!sh.made];
        if (!list || !list.length) return;
        var c = list.shift();
        sh.src = c.src; sh.thumb = c.thumb; sh.clipless = false;
        sh.meta = games[sh.gameIdx].date + " " + games[sh.gameIdx].opp + " · film " + filmTime(c.t);
      });
    }

    SHOT_STORE[player] = shots;

    // --- 2) zones: each zone shaded by its FG% minus league average from that zone ---
    var svg = el("svg", { viewBox: "0 0 500 350", class: "spray-court",
      "aria-label": "Shot chart: court zones shaded by field-goal percentage versus league average, with every shot plotted as a make or a miss" });
    var uid = "sc" + Math.random().toString(36).slice(2, 7);
    var ARC3 = "M30,0 L30,142 A237.5,237.5 0 0 0 470,142 L470,0 Z";
    var RA = "M210,0 L210,52.5 A40,40 0 0 0 290,52.5 L290,0 Z";
    var PAINT = "M170,0 L170,190 L330,190 L330,0 Z";
    var REGIONS = { ra: RA, paint: PAINT + " " + RA, mid: ARC3 + " " + PAINT, three: "M0,0 L0,350 L500,350 L500,0 Z " + ARC3 };
    function wedge(a0, a1) {
      var R = 1200, pts = [HX + "," + HY];
      function pt(deg) { var r = deg * Math.PI / 180; return (HX + R * Math.cos(r)).toFixed(1) + "," + (HY + R * Math.sin(r)).toFixed(1); }
      for (var a = a0; a < a1; a += 10) pts.push(pt(a));
      pts.push(pt(a1));
      return "M" + pts.join(" L") + " Z";
    }
    var defs = el("defs", {}, svg);
    Object.keys(REGIONS).forEach(function (r) {
      el("path", { d: REGIONS[r], "clip-rule": "evenodd" }, el("clipPath", { id: uid + "-" + r }, defs));
    });
    el("rect", { x: 0, y: 0, width: 500, height: 350, class: "court-bg" }, svg);
    rows.forEach(function (r) {
      var g = el("g", { "clip-path": "url(#" + uid + "-" + r.z.region + ")" }, svg);
      el("title", {}, el("path", { d: wedge(r.z.a[0], r.z.a[1]), class: "zone z-" + r.b }, g)).textContent =
        r.z.name + ": " + r.s.fgm + "/" + r.s.fga + " (" + r.fg.toFixed(1) + "%) · League " + r.s.lg.toFixed(1) + "% · " + (r.diff >= 0 ? "+" : "") + r.diff.toFixed(1);
    });
    // radial zone dividers, clipped to their region
    ZONES.forEach(function (z) {
      [z.a[0], z.a[1]].forEach(function (a) {
        if (a === -90 || a === 270) return;
        var rad = a * Math.PI / 180;
        el("line", { x1: HX, y1: HY, x2: HX + 1200 * Math.cos(rad), y2: HY + 1200 * Math.sin(rad), class: "court-line" },
          el("g", { "clip-path": "url(#" + uid + "-" + z.region + ")" }, svg));
      });
    });

    // court lines on top of the zones
    el("path", { d: "M30,0 L30,142 A237.5,237.5 0 0 0 470,142 L470,0", class: "court-line" }, svg);
    el("path", { d: "M170,0 L170,190 L330,190 L330,0", class: "court-line" }, svg);
    el("path", { d: "M210,0 L210,52.5 A40,40 0 0 0 290,52.5 L290,0", class: "court-line" }, svg);
    el("rect", { x: 1, y: 1, width: 498, height: 348, class: "court-frame" }, svg);
    el("line", { x1: 220, y1: 40, x2: 280, y2: 40, class: "backboard" }, svg);
    el("circle", { cx: HX, cy: HY, r: 7.5, class: "rim" }, svg);

    // --- 3) shot dots, each a link to its clip ---
    var dots = el("g", { class: "shot-dots" }, svg);
    shots.forEach(function (s) {
      var a;
      if (s.clipless) {
        // no film for this shot: plain mark, not a link
        a = el("g", { class: "shot shot-nofilm " + (s.made ? "shot-make" : "shot-miss") }, dots);
        el("title", {}, a).textContent = s.title + "\n" + s.meta + "\nNo clip for this shot";
      } else {
        var href = filmHref
          ? filmHref + "?shot=" + encodeURIComponent(s.id) + "&title=" + encodeURIComponent(s.title) +
            "&meta=" + encodeURIComponent(s.meta) + (s.src ? "&src=" + encodeURIComponent(s.src) : "&v=" + s.video + "&t=" + s.start)
          : "#" + s.id;
        a = el("a", { href: href, class: "shot " + (s.made ? "shot-make" : "shot-miss"),
          "aria-label": s.title + ", " + s.meta + ". Watch clip" }, dots);
        el("title", {}, a).textContent = s.title + "\n" + s.meta + "\nClick to watch the clip";
      }
      el("circle", { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 7, class: "shot-hit" }, a);
      if (s.made) {
        el("circle", { cx: s.x.toFixed(1), cy: s.y.toFixed(1), r: 3.6, class: "shot-mark" }, a);
      } else {
        var d = "M" + (s.x - 3.2).toFixed(1) + "," + (s.y - 3.2).toFixed(1) + " L" + (s.x + 3.2).toFixed(1) + "," + (s.y + 3.2).toFixed(1) +
                " M" + (s.x + 3.2).toFixed(1) + "," + (s.y - 3.2).toFixed(1) + " L" + (s.x - 3.2).toFixed(1) + "," + (s.y + 3.2).toFixed(1);
        el("path", { d: d, class: "shot-halo" }, a);
        el("path", { d: d, class: "shot-mark" }, a);
      }
      if (!filmHref && !s.clipless) a.addEventListener("click", function (e) { e.preventDefault(); openClipDialog(s); });
    });


    var filter = host.querySelector("[data-spray-filter]");
    if (filter) {
      svg.setAttribute("data-show", filter.value);
      filter.addEventListener("change", function () { svg.setAttribute("data-show", filter.value); });
    }

    // Totals line ([data-spray-totals]) is computed from the zones so it can never drift from them
    var totalsEl = host.querySelector("[data-spray-totals]");
    if (totalsEl) {
      var fgm = 0, fga = 0, tpm = 0, tpa = 0;
      rows.forEach(function (r) {
        fgm += r.s.fgm; fga += r.s.fga;
        if (r.z.region === "three") { tpm += r.s.fgm; tpa += r.s.fga; }
      });
      totalsEl.textContent = "Totals: " + fgm + "–" + fga + " FG (" + pct(fgm, fga).toFixed(1) + "%), " +
        tpm + "–" + tpa + " 3PT (" + pct(tpm, tpa).toFixed(1) + "%).";
    }

    var chartSlot = host.querySelector("[data-spray-svg]") || host;
    chartSlot.appendChild(svg);

    var tbody = host.querySelector("[data-spray-table] tbody");
    if (tbody) {
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        var sign = r.diff >= 0 ? "+" : "";
        var cls = r.diff >= 2 ? "diff-pos" : (r.diff <= -2 ? "diff-neg" : "");
        tr.innerHTML =
          '<td><span class="zone-dot" style="background:var(--zone-' + r.b + ')"></span>' + r.z.name + "</td>" +
          '<td class="num tnum">' + r.s.fgm + "–" + r.s.fga + "</td>" +
          '<td class="num tnum">' + r.fg.toFixed(1) + "%</td>" +
          '<td class="num tnum">' + r.s.lg.toFixed(1) + "%</td>" +
          '<td class="num tnum ' + cls + '">' + sign + r.diff.toFixed(1) + "</td>";
        tbody.appendChild(tr);
      });
    }
  });

  // Film Room play library (public player page's "Film Room" tab): [data-film-library] with JSON
  // { plays: { Rebound: n, Assist: n, ... }, offensiveRebounds: n }. Made/missed shots are the exact
  // shots the shot chart generated (SHOT_STORE), so counts match the chart and the Per Game line;
  // every other play type is a placeholder generated (seeded, so stable) to match the season totals.
  // Filters: play-type chips, game, 2PT/3PT (shots only) and free-text search; results open in the clip pop-up.
  document.querySelectorAll("[data-film-library]").forEach(function (lib) {
    var player = lib.getAttribute("data-player") || "Player";
    var filmHref = lib.getAttribute("data-film-href"); // Team Portal only: results open the Film Room page instead of the pop-up
    var cfg = {};
    var cfgSrc = lib.querySelector('script[type="application/json"]');
    if (cfgSrc) { try { cfg = JSON.parse(cfgSrc.textContent); } catch (e) {} }
    var games = [], realClips = null;
    var trendSrc = document.querySelector('[data-trend-chart] script[type="application/json"]');
    if (trendSrc) { try { var td = JSON.parse(trendSrc.textContent); games = td.games || []; realClips = td.clips || null; } catch (e) {} }

    var h = 2166136261, seed = player + "|plays";
    for (var si = 0; si < seed.length; si++) { h ^= seed.charCodeAt(si); h = Math.imul(h, 16777619); }
    function rand() {
      h = (h + 0x6D2B79F5) | 0;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function pick(a) { return a[Math.floor(rand() * a.length)]; }

    var plays = [];
    // Real game film (SportsVisio): the library is exactly his real clips - no placeholder plays at all.
    if (realClips) {
      realClips.forEach(function (c, i) {
        var g = games[c.game], p = String(c.t || "").split(":");
        var made = c.made !== false, ft = c.kind === "FT";
        plays.push({ id: "C" + (i + 1), type: ft ? "Free Throw" : made ? "Made Shot" : "Missed Shot", shot: ft ? "" : c.kind,
          title: (made ? "Made " : "Missed ") + (ft ? "free throw" : c.kind === "3PT" ? "3-pointer" : "2-pointer"),
          meta: (g ? g.date + " " + g.opp + " · " : "") + "film " + filmTime(c.t), gameIdx: c.game,
          sortKey: (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0), src: c.src, thumb: c.thumb });
      });
    }
    (realClips ? [] : SHOT_STORE[player] || []).forEach(function (s) {
      plays.push({ id: s.id, type: s.made ? "Made Shot" : "Missed Shot", shot: s.kind, title: s.title.replace(player + " — ", ""),
        meta: s.meta, gameIdx: s.gameIdx, sortKey: s.sortKey, video: s.video, start: s.start });
    });
    var mates = ["J. Kim", "A. Reyes", "D. Whitfield", "C. Turner", "S. Osei", "M. Patel", "L. Grant", "R. Cho"];
    var TEMPLATES = {
      Rebound:  function (i) { return i < (cfg.offensiveRebounds || 0) ? pick(["Offensive rebound, put-back attempt", "Offensive rebound off a missed three", "Tip-out offensive rebound"]) : pick(["Defensive rebound, starts the break", "Defensive rebound in traffic", "Defensive board off a long miss"]); },
      Assist:   function () { return "Assist to " + pick(mates) + " — " + pick(["corner three", "layup in transition", "pick-and-roll lob", "kick-out three", "backdoor cut"]); },
      Steal:    function () { return pick(["Steal — jumped the passing lane", "Steal — poked loose on the drive", "Steal off the inbound", "Steal and coast-to-coast finish"]); },
      Block:    function () { return pick(["Block at the rim", "Chase-down block in transition", "Blocked a pull-up jumper"]); },
      Turnover: function () { return "Turnover — " + pick(["bad pass", "lost ball", "travel", "offensive foul", "stepped out of bounds"]); },
      Foul:     function () { return "Personal foul — " + pick(["reach-in", "shooting foul", "blocking foul", "loose-ball foul"]); }
    };
    // Each play goes to a game in line with that game's box score (AST, STL, BLK, TOV, PF, ORB/DRB in the
    // game data), so filtering the Film Room to one game shows exactly that game's plays.
    var slotCache = {}, STAT_KEY = { Assist: "AST", Steal: "STL", Block: "BLK", Turnover: "TOV", Foul: "PF" };
    function gameSlot(key) {
      if (!slotCache[key]) {
        var arr = [];
        if (games.length && games[0][key] != null) games.forEach(function (gm, gi) { for (var q = 0; q < gm[key]; q++) arr.push(gi); });
        for (var q = arr.length - 1; q > 0; q--) { var j = Math.floor(rand() * (q + 1)), tmp = arr[q]; arr[q] = arr[j]; arr[j] = tmp; }
        slotCache[key] = arr;
      }
      var v = slotCache[key].pop();
      return v == null ? (games.length ? Math.floor(rand() * games.length) : -1) : v;
    }
    Object.keys(realClips ? {} : cfg.plays || {}).forEach(function (type) {
      for (var i = 0; i < cfg.plays[type]; i++) {
        var key = type === "Rebound" ? (i < (cfg.offensiveRebounds || 0) ? "ORB" : "DRB") : STAT_KEY[type];
        var gi = key ? gameSlot(key) : (games.length ? Math.floor(rand() * games.length) : -1), g = games[gi];
        var half = rand() < 0.5 ? "1H" : "2H", secs = Math.floor(rand() * 1200);
        var clock = Math.floor(secs / 60) + ":" + ("0" + (secs % 60)).slice(-2);
        plays.push({ type: type, shot: "", title: (TEMPLATES[type] || function () { return type; })(i),
          meta: (g ? g.date + " " + g.opp + " · " : "") + half + " " + clock, gameIdx: gi,
          sortKey: (half === "2H" ? 1200 : 0) + (1200 - secs), video: CLIP_VIDEOS[plays.length % CLIP_VIDEOS.length], start: 5 + Math.floor(rand() * 240) });
      }
    });
    plays.sort(function (a, b) { return (b.gameIdx - a.gameIdx) || (b.sortKey - a.sortKey); }); // newest game first, latest in the game first

    // "Free Throw" only exists with real film (SportsVisio clips free throws); placeholder data has none
    var TYPES = ["Made Shot", "Missed Shot"].concat(plays.some(function (p) { return p.type === "Free Throw"; }) ? ["Free Throw"] : [])
      .concat(["Rebound", "Assist", "Steal", "Block", "Turnover", "Foul"]);
    var BADGE = { "Made Shot": "badge-success", "Missed Shot": "badge-danger", "Free Throw": "badge-success", Rebound: "badge-info", Assist: "badge-accent", Steal: "badge-warning", Block: "badge-info", Turnover: "badge-danger", Foul: "" };
    var state = { type: "", game: "", shot: "", q: "", shown: 24 };
    var chipsEl = lib.querySelector("[data-film-types]"), gameEl = lib.querySelector("[data-film-game]"),
        shotEl = lib.querySelector("[data-film-shot]"), qEl = lib.querySelector("[data-film-search]"),
        statusEl = lib.querySelector("[data-film-status]"), resultsEl = lib.querySelector("[data-film-results]"),
        moreEl = lib.querySelector("[data-film-more]"), shotField = shotEl ? shotEl.closest(".field") : null;

    // "Shot" is a combined type (made + missed), used for attempts (FGA/3PA/2PA) and shown as "All shots"
    function typeMatches(type, p) { return !type || (type === "Shot" ? (p.type === "Made Shot" || p.type === "Missed Shot") : p.type === type); }
    function count(type) { return plays.filter(function (p) { return typeMatches(type, p); }).length; }
    ["", "Shot"].concat(TYPES).forEach(function (type) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "film-chip"; b.setAttribute("data-type", type);
      b.setAttribute("aria-pressed", type === state.type ? "true" : "false");
      b.innerHTML = (type === "Shot" ? "All shots" : type || "All plays") + ' <span class="film-chip-n">' + count(type) + "</span>";
      b.addEventListener("click", function () { state.type = type; state.shown = 24; render(); });
      chipsEl.appendChild(b);
    });
    if (gameEl) {
      gameEl.innerHTML = '<option value="">All games</option>' + games.map(function (g, i) { return '<option value="' + i + '">' + g.date + " " + g.opp + "</option>"; }).reverse().join("");
      gameEl.addEventListener("change", function () { state.game = gameEl.value; state.shown = 24; render(); });
    }
    if (shotEl) shotEl.addEventListener("change", function () { state.shot = shotEl.value; state.shown = 24; render(); });
    if (qEl) qEl.addEventListener("input", function () { state.q = qEl.value.trim().toLowerCase(); state.shown = 24; render(); });
    if (moreEl) moreEl.addEventListener("click", function () { state.shown += 24; render(); });

    function render() {
      chipsEl.querySelectorAll(".film-chip").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-type") === state.type ? "true" : "false"); });
      var shotsOnly = !state.type || state.type === "Shot" || state.type === "Made Shot" || state.type === "Missed Shot";
      if (shotField) shotField.hidden = !shotsOnly;
      var list = plays.filter(function (p) {
        if (!typeMatches(state.type, p)) return false;
        if (state.game !== "" && String(p.gameIdx) !== state.game) return false;
        if (shotsOnly && state.shot && p.shot !== state.shot) return false;
        if (state.q && (p.type + " " + p.title + " " + p.meta).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
      var label = state.type ? state.type.toLowerCase() + (list.length === 1 || /s$/.test(state.type) ? "" : "s") : (list.length === 1 ? "play" : "plays");
      statusEl.textContent = list.length
        ? "Showing " + Math.min(state.shown, list.length) + " of " + list.length + " " + label + (state.game !== "" ? " in this game" : "")
        : "No " + label + " match these filters.";
      resultsEl.innerHTML = "";
      list.slice(0, state.shown).forEach(function (p) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "film-result";
        b.setAttribute("aria-label", p.type + ": " + p.title + ", " + p.meta + ". Watch clip");
        b.innerHTML =
          '<span class="fr-thumb"><img src="' + (p.thumb || "https://i.ytimg.com/vi/" + p.video + "/mqdefault.jpg") + '" alt="" loading="lazy">' +
          '<span class="fr-play" aria-hidden="true">&#9654;</span><span class="fr-badge badge ' + (BADGE[p.type] || "") + '"></span></span>' +
          '<span class="fr-body"><strong></strong><span class="muted"></span></span>';
        b.querySelector(".fr-badge").textContent = p.type;
        b.querySelector(".fr-body strong").textContent = p.title;
        b.querySelector(".fr-body .muted").textContent = p.meta;
        b.addEventListener("click", function () {
          var clip = { title: player + " — " + p.title, meta: p.meta, video: p.video, start: p.start, src: p.src };
          if (filmHref) { // Team Portal: open the play in the full Film Room page, same deep link the shot chart uses
            window.location.href = filmHref + "?shot=" + encodeURIComponent(p.id || "P") + "&title=" + encodeURIComponent(clip.title) +
              "&meta=" + encodeURIComponent(clip.meta) + (clip.src ? "&src=" + encodeURIComponent(clip.src) : "&v=" + clip.video + "&t=" + clip.start);
          } else { openClipDialog(clip); }
        });
        resultsEl.appendChild(b);
      });
      if (moreEl) moreEl.hidden = list.length <= state.shown;
    }
    render();

    // Let other parts of the page (the Game Log's stat links) open the library pre-filtered:
    // lib.filmFilter({ type: "Assist", game: 13, shot: "3PT", q: "offensive" }) — missing keys reset to "any".
    lib.filmFilter = function (opts) {
      opts = opts || {};
      state.type = opts.type || ""; state.game = opts.game != null ? String(opts.game) : "";
      state.shot = opts.shot || ""; state.q = (opts.q || "").toLowerCase(); state.shown = 24;
      if (gameEl) gameEl.value = state.game;
      if (shotEl) shotEl.value = state.shot;
      if (qEl) qEl.value = opts.q || "";
      render();
    };
    // How many plays a filter would show (the Game Log only links a stat when there's film behind it)
    lib.filmCount = function (opts) {
      opts = opts || {};
      var q = (opts.q || "").toLowerCase(), game = opts.game != null ? String(opts.game) : "";
      return plays.filter(function (p) {
        return typeMatches(opts.type || "", p) && (game === "" || String(p.gameIdx) === game) &&
          (!opts.shot || p.shot === opts.shot) && (!q || (p.type + " " + p.title + " " + p.meta).toLowerCase().indexOf(q) !== -1);
      }).length;
    };
  });

  // Game Log (all three player pages): [data-gamelog] is filled with a Basketball-Reference-style game log built
  // from the same per-game JSON as the trend chart (one source, so the log, trend chart, shot chart and Film Room
  // always agree). Columns are only shown when the data has them (e.g. Result/GS/PF/PIE), a missing value
  // (null, e.g. minutes SportsVisio didn't record) shows as an em dash, and the footer is the per-game average.
  // A stat links into the Film Room only when the Film Room actually has plays for it (lib.filmCount).
  document.querySelectorAll("[data-gamelog]").forEach(function (host) {
    var src = document.querySelector('[data-trend-chart] script[type="application/json"]');
    if (!src) return;
    var games = [];
    try { games = JSON.parse(src.textContent).games || []; } catch (e) { return; }
    var gameHref = host.getAttribute("data-game-href");
    var n = games.length;
    function has(k) { return games.some(function (g) { return g[k] != null && g[k] !== ""; }); }
    function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
    function pct(m, a) { if (!a) return ""; var s = (m / a).toFixed(3); return s.charAt(0) === "0" ? s.slice(1) : s; }
    function sum(k) { return games.reduce(function (a, g) { return a + (+g[k] || 0); }, 0); }
    function cnt(k) { return games.length ? { v: function (g) { return g[k] == null ? "\u2014" : String(g[k]); },
      a: function () { return games.every(function (g) { return g[k] != null; }) ? f1(sum(k) / n) : "\u2014"; } } : null; }
    function ratio(mk, ak) { return { v: function (g) { return pct(mk(g), ak(g)); }, a: function () { return pct(sum2(mk), sum2(ak)); } }; }
    function sum2(fn) { return games.reduce(function (a, g) { return a + fn(g); }, 0); }
    function k(name) { return function (g) { return +g[name] || 0; }; }
    function diff(a, b) { return function (g) { return (+g[a] || 0) - (+g[b] || 0); }; }
    var C = [];
    function col(h, title, def, film, show) { if (show === false) return; C.push({ h: h, title: title, def: def, film: film }); }
    var c2 = function (fn) { return { v: function (g) { return String(fn(g)); }, a: function () { return f1(sum2(fn) / n); } }; };
    col("GS", "Game Started", cnt("GS"), null, has("GS"));
    col("MP", "Minutes Played", cnt("MIN"), null, has("MIN"));
    col("PTS", "Points", cnt("PTS"));
    col("FG", "Field Goals", cnt("FGM"), { type: "Made Shot", what: "made shots" });
    col("FGA", "Field Goal Attempts", cnt("FGA"), { type: "Shot", what: "shots" });
    col("FG%", "Field Goal Percentage", ratio(k("FGM"), k("FGA")));
    col("3P", "3-Point Field Goals", cnt("TPM"), { type: "Made Shot", shot: "3PT", what: "made threes" });
    col("3PA", "3-Point Field Goal Attempts", cnt("TPA"), { type: "Shot", shot: "3PT", what: "three-point attempts" });
    col("3P%", "3-Point Field Goal Percentage", ratio(k("TPM"), k("TPA")));
    col("2P", "2-Point Field Goals", c2(diff("FGM", "TPM")), { type: "Made Shot", shot: "2PT", what: "made twos" });
    col("2PA", "2-Point Field Goal Attempts", c2(diff("FGA", "TPA")), { type: "Shot", shot: "2PT", what: "two-point attempts" });
    col("2P%", "2-Point Field Goal Percentage", ratio(diff("FGM", "TPM"), diff("FGA", "TPA")));
    col("eFG%", "Effective Field Goal Percentage (counts a 3 as 1.5 makes)", ratio(function (g) { return (+g.FGM || 0) + 0.5 * (+g.TPM || 0); }, k("FGA")));
    col("FT", "Free Throws", cnt("FTM"), { type: "Free Throw", q: "made", what: "made free throws" });
    col("FTA", "Free Throw Attempts", cnt("FTA"), { type: "Free Throw", what: "free-throw attempts" });
    col("FT%", "Free Throw Percentage", ratio(k("FTM"), k("FTA")));
    col("ORB", "Offensive Rebounds", cnt("ORB"), { type: "Rebound", q: "offensive", what: "offensive rebounds" });
    col("DRB", "Defensive Rebounds", cnt("DRB"), { type: "Rebound", q: "defensive", what: "defensive rebounds" });
    col("TRB", "Total Rebounds", cnt("REB"), { type: "Rebound", what: "rebounds" });
    col("AST", "Assists", cnt("AST"), { type: "Assist", what: "assists" });
    col("STL", "Steals", cnt("STL"), { type: "Steal", what: "steals" });
    col("BLK", "Blocks", cnt("BLK"), { type: "Block", what: "blocks" });
    col("TOV", "Turnovers", cnt("TOV"), { type: "Turnover", what: "turnovers" });
    col("PF", "Personal Fouls", cnt("PF"), { type: "Foul", what: "fouls" }, has("PF"));
    col("GmSc", "Game Score (John Hollinger's single-number summary of a box score)", { v: function (g) { return f1(+g.GMSC || 0); }, a: function () { return f1(sum("GMSC") / n); } }, null, has("GMSC"));
    col("PIE", "Player Impact Estimate, as published by SportsVisio", { v: function (g) { return g.PIE == null ? "\u2014" : f1(+g.PIE); }, a: function () { return f1(sum("PIE") / n); } }, null, has("PIE"));
    var hasResult = has("result");
    var lib = document.querySelector("[data-film-library]");
    function filmCount(f, gi) { return lib && lib.filmCount ? lib.filmCount({ type: f.type, shot: f.shot, q: f.q, game: gi }) : 0; }

    var head = "<tr><th scope=\"col\" class=\"num\" title=\"Game number\">G</th><th scope=\"col\">Date</th><th scope=\"col\" title=\"Opponent\">Opp</th>" +
      (hasResult ? "<th scope=\"col\" title=\"Final score\">Result</th>" : "") +
      C.map(function (c) { return "<th scope=\"col\" class=\"num\" title=\"" + c.title + "\">" + c.h + "</th>"; }).join("") + "</tr>";
    var body = games.map(function (g, i) {
      var cells = "";
      if (hasResult) {
        var r = String(g.result || ""), cls = r.charAt(0) === "W" ? "badge-success" : r.charAt(0) === "L" ? "badge-danger" : "";
        var badge = "<span class=\"badge " + cls + "\">" + r + "</span>";
        cells += "<td>" + (gameHref ? "<a href=\"" + gameHref + "\">" + badge + "</a>" : badge) + "</td>";
      }
      cells += C.map(function (c, ci) {
        var v = c.def.v(g), f = c.film, nFilm = f && +v > 0 ? filmCount(f, i) : 0;
        if (!nFilm) return "<td class=\"num\">" + v + "</td>";
        var what = nFilm === 1 ? f.what.replace(/s$/, "") : f.what;
        return "<td class=\"num\"><a href=\"#film-room\" class=\"gl-film\" data-ci=\"" + ci + "\" data-game=\"" + i + "\" title=\"Watch " +
          (nFilm < +v ? "the " + nFilm + " of his " + v + " " + f.what + " on film" : "his " + v + " " + what) + " from " + g.date + " in the Film Room\">" + v + "</a></td>";
      }).join("");
      return "<tr><th scope=\"row\" class=\"num\">" + (i + 1) + "</th><td>" + g.date + "</td><td>" + g.opp + "</td>" + cells + "</tr>";
    }).join("");
    var label = "Season per game";
    if (hasResult) {
      var w = games.filter(function (g) { return /^W/.test(g.result); }).length, l = games.filter(function (g) { return /^L/.test(g.result); }).length, t = n - w - l;
      label += " <span class=\"gl-record\">(" + w + "-" + l + (t ? "-" + t : "") + ")</span>";
    }
    var foot = "<tr><th scope=\"row\" colspan=\"" + (hasResult ? 4 : 3) + "\">" + label + "</th>" +
      C.map(function (c) { return "<td class=\"num\">" + c.def.a() + "</td>"; }).join("") + "</tr>";
    host.innerHTML = "<div class=\"pergame-scroll\"><table class=\"pergame-table gamelog-table\"><thead>" + head + "</thead><tbody>" + body + "</tbody><tfoot>" + foot + "</tfoot></table></div>";

    // Clicking a linked stat switches to the Film Room tab and filters it to that game + play type
    host.addEventListener("click", function (e) {
      var a = e.target.closest("a.gl-film"); if (!a || !lib || !lib.filmFilter) return;
      e.preventDefault();
      var f = C[+a.getAttribute("data-ci")].film, panel = lib.closest("[role=tabpanel]");
      var tab = panel ? document.querySelector('[role=tab][aria-controls="' + panel.id + '"]') : null;
      if (tab) tab.click();
      lib.filmFilter({ type: f.type, shot: f.shot, q: f.q, game: +a.getAttribute("data-game") });
      lib.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  // Buttons that open a tab elsewhere on the page, e.g. the player header's "Watch Film" -> Film Room tab
  document.querySelectorAll("[data-open-tab]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var tab = document.getElementById(link.getAttribute("data-open-tab"));
      if (!tab) return;
      e.preventDefault(); tab.click();
      var bar = tab.closest("[data-tabbar]"); if (bar) bar.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Film Room deep link from the shot chart: film-room.html?shot=S123&title=…&meta=…&v=<youtube id>&t=<sec>
  // renders that shot's clip in [data-shot-clip] above the clip grid. Params are shown via textContent only.
  var shotSlot = document.querySelector("[data-shot-clip]");
  if (shotSlot && window.URLSearchParams) {
    var qp = new URLSearchParams(window.location.search);
    var vid = qp.get("v") || "", start = parseInt(qp.get("t") || "0", 10), mp4 = qp.get("src") || "";
    var realMp4 = REAL_CLIP_RE.test(mp4);
    if (qp.get("shot") && (realMp4 || /^[A-Za-z0-9_-]{11}$/.test(vid))) {
      shotSlot.hidden = false;
      shotSlot.querySelector("[data-shot-title]").textContent = qp.get("title") || "Shot clip";
      shotSlot.querySelector("[data-shot-meta]").textContent = qp.get("meta") || "";
      var frame = shotSlot.querySelector("iframe");
      if (realMp4) {
        // Real SportsVisio game film: play the mp4 itself instead of the YouTube placeholder
        var video = document.createElement("video");
        video.controls = true; video.playsInline = true; video.preload = "metadata";
        video.src = mp4; video.poster = mp4.replace(/clip\.mp4$/, "clip.0000001.jpg");
        video.setAttribute("aria-label", qp.get("title") || "Shot clip");
        if (frame) frame.replaceWith(video); else shotSlot.appendChild(video);
        var note = shotSlot.querySelector("[data-shot-note]");
        if (note) note.textContent = "Game film from SportsVisio.";
      } else if (frame) {
        frame.src = "https://www.youtube.com/embed/" + vid + "?start=" + (isNaN(start) ? 0 : start);
      }
      shotSlot.scrollIntoView({ block: "start" });
    }
  }

  // Season trend chart: [data-trend-chart] holds a <script type="application/json"> with
  // { window: 5, stats: [{key,label,dp,suffix}], games: [{date,opp,result,<key>:value,...}] }.
  // Draws the N-game rolling average as a line (early games average whatever games exist so far),
  // each game's own value as a faint dot, and a hover/tap/focus tooltip per game. A
  // [data-trend-stat] <select> in the card picks which stat is plotted.
  document.querySelectorAll("[data-trend-chart]").forEach(function (host) {
    var src = host.querySelector('script[type="application/json"]');
    var plot = host.querySelector("[data-trend-plot]");
    var select = host.querySelector("[data-trend-stat]");
    if (!src || !plot) return;
    var data = JSON.parse(src.textContent);
    var N = data.window || 5, games = data.games, stats = data.stats;
    var NS = "http://www.w3.org/2000/svg";
    var W = 600, H = 240, PL = 40, PR = 14, PT = 14, PB = 30, current = null; // W is re-measured each render so the chart draws 1:1 at its real width

    if (select) {
      stats.forEach(function (s) {
        var o = document.createElement("option"); o.value = s.key; o.textContent = s.label; select.appendChild(o);
      });
      select.addEventListener("change", function () { render(select.value); });
    }

    var tip = document.createElement("div");
    tip.className = "trend-tip"; tip.hidden = true; tip.setAttribute("role", "status");
    plot.appendChild(tip);

    function el(tag, attrs, parent) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }
    function fmt(v, s, avg) { var dp = avg && s.adp != null ? s.adp : (s.dp || 0); return v.toFixed(dp) + (s.suffix || ""); }
    function niceStep(range) {
      var raw = range / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
      return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    }

    function render(key) {
      current = key;
      W = Math.max(300, Math.round(plot.clientWidth || 600));
      var s = stats.filter(function (x) { return x.key === key; })[0] || stats[0];
      var vals = games.map(function (g) { return g[s.key]; });
      var roll = vals.map(function (_, i) {
        var from = Math.max(0, i - N + 1), win = vals.slice(from, i + 1);
        return win.reduce(function (a, b) { return a + b; }, 0) / win.length;
      });
      var hasLg = typeof s.lg === "number";
      var lo = Math.min.apply(null, hasLg ? vals.concat([s.lg]) : vals), hi = Math.max.apply(null, hasLg ? vals.concat([s.lg]) : vals);
      var step = niceStep((hi - lo) || 1);
      var y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
      if (y1 === y0) y1 = y0 + step;
      var x = function (i) { return PL + (games.length === 1 ? 0 : i * (W - PL - PR) / (games.length - 1)); };
      var y = function (v) { return PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB); };

      var old = plot.querySelector("svg"); if (old) old.remove();
      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "trend-svg", role: "img",
        "aria-label": s.label + ", " + N + "-game rolling average across " + games.length + " games" });
      plot.insertBefore(svg, tip);

      for (var t = y0; t <= y1 + step / 2; t += step) {
        el("line", { x1: PL, x2: W - PR, y1: y(t), y2: y(t), class: "trend-grid" }, svg);
        el("text", { x: PL - 8, y: y(t) + 4, class: "trend-axis", "text-anchor": "end" }, svg).textContent = fmt(t, { dp: step < 1 ? (step < 0.1 ? 2 : 1) : 0, suffix: s.suffix });
      }
      var perGame = (W - PL - PR) / Math.max(1, games.length - 1), labelEvery = perGame >= 56 ? 1 : perGame >= 30 ? 2 : 3;
      games.forEach(function (g, i) {
        if ((games.length - 1 - i) % labelEvery === 0) el("text", { x: x(i), y: H - 8, class: "trend-axis", "text-anchor": "middle" }, svg).textContent = g.date;
      });
      // league average for this stat: dotted line across the plot, labelled at the right edge
      if (hasLg) {
        el("line", { x1: PL, x2: W - PR, y1: y(s.lg), y2: y(s.lg), class: "trend-lg" }, svg);
        var lgLabelAbove = y(s.lg) - PT > 16;
        el("text", { x: W - PR - 2, y: y(s.lg) + (lgLabelAbove ? -6 : 14), class: "trend-lg-label", "text-anchor": "end" }, svg)
          .textContent = "Lg avg " + fmt(s.lg, s, true);
      }
      // raw single-game values (faint), then the rolling-average line + points on top
      games.forEach(function (g, i) { el("circle", { cx: x(i), cy: y(vals[i]), r: 3.5, class: "trend-raw" }, svg); });
      el("polyline", { points: roll.map(function (v, i) { return x(i) + "," + y(v); }).join(" "), class: "trend-line" }, svg);
      var dots = roll.map(function (v, i) { return el("circle", { cx: x(i), cy: y(v), r: 4.5, class: "trend-dot" }, svg); });

      // one full-height hit column per game so hovering anywhere near a game works
      var colW = (W - PL - PR) / Math.max(1, games.length - 1);
      games.forEach(function (g, i) {
        var hit = el("rect", { x: x(i) - colW / 2, y: PT, width: colW, height: H - PT - PB, class: "trend-hit", tabindex: 0,
          "aria-label": g.date + " " + g.opp + ": " + fmt(vals[i], s) + ", " + N + "-game average " + fmt(roll[i], s, true) +
            (hasLg ? ", league average " + fmt(s.lg, s, true) : "") }, svg);
        function show() {
          dots.forEach(function (d) { d.classList.remove("is-active"); }); dots[i].classList.add("is-active");
          var n = Math.min(i + 1, N);
          tip.innerHTML = '<div class="tt-date">' + g.date + " · " + g.opp + (g.result ? ' <span class="tt-res">' + g.result + "</span>" : "") + "</div>" +
            '<div class="tt-row"><span>' + s.label + "</span><b>" + fmt(vals[i], s) + "</b></div>" +
            '<div class="tt-row"><span>' + (n < N ? n + "-game avg (season start)" : N + "-game avg") + "</span><b>" + fmt(roll[i], s, true) + "</b></div>" +
            (hasLg ? '<div class="tt-row tt-lg"><span>League avg</span><b>' + fmt(s.lg, s, true) + "</b></div>" : "");
          tip.hidden = false;
          var pr = plot.getBoundingClientRect(), sr = svg.getBoundingClientRect();
          var px = (x(i) / W) * sr.width + (sr.left - pr.left), py = (y(roll[i]) / H) * sr.height + (sr.top - pr.top);
          var tw = tip.offsetWidth, left = Math.min(Math.max(px - tw / 2, 0), pr.width - tw);
          tip.style.left = left + "px";
          tip.style.top = Math.max(py - tip.offsetHeight - 12, 0) + "px";
        }
        function hide() { tip.hidden = true; dots[i].classList.remove("is-active"); }
        hit.addEventListener("mouseenter", show); hit.addEventListener("focus", show);
        hit.addEventListener("click", show);
        hit.addEventListener("mouseleave", hide); hit.addEventListener("blur", hide);
      });
    }
    render(select && select.value ? select.value : stats[0].key);
    var resizeTimer;
    window.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { tip.hidden = true; render(current); }, 120); });
  });
})();
