<script>
// Game recap page script. Reads two JSON blocks: #game-meta (teams, final score, cameras) and #pbp-data (tagged plays in film order with the running score [Team Jeremy, opponent]).
(function () {
  var metaEl = document.getElementById("game-meta"), el = document.getElementById("pbp-data");
  if (!metaEl || !el) return;
  var M = JSON.parse(metaEl.textContent), plays = JSON.parse(el.textContent);
  var CLIP = /^https:\/\/api\.sportsvisio-api\.com\/media\/[0-9a-f\/-]+\/(clip|transcoded\/full)\.mp4$/;
  var TEAM = {}; TEAM[M.tj.code] = M.tj; TEAM[M.opp.code] = M.opp;
  var A = M.tj.code, B = M.opp.code;
  function secs(tc) { var p = tc.split(":"); return (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]) + (+p[3] || 0) / 30; }
  function film(tc) { var p = tc.split(":"), h = +p[0]; return h ? h + ":" + p[1] + ":" + p[2] : (+p[1]) + ":" + p[2]; }
  function mmss(s) { s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + ("0" + m).slice(-2) : m) + ":" + ("0" + s % 60).slice(-2); }
  function scoreTxt(s) { return A + " " + s[0] + "–" + s[1] + " " + B; }
  function camOf(src) { var id = (src.split("/")[5] || ""); for (var i = 0; i < M.cams.length; i++) if (M.cams[i].id === id) return i; return M.defaultCam; }
  function load(video, src, autoplay, at) {
    if (!CLIP.test(src)) return;
    video.src = src;
    if (at != null) video.addEventListener("loadedmetadata", function go() { video.removeEventListener("loadedmetadata", go); video.currentTime = at; if (autoplay) video.play().catch(function () {}); });
    else if (autoplay) video.play().catch(function () {});
  }
  plays.forEach(function (p) { p.x = p.t ? secs(p.t) : null; });
  var timed = plays.filter(function (p) { return p.x != null; });

  // --- Highlight strip: play a clip (or the full game) in the Gamecast film player ---
  var gv = document.querySelector("[data-recap-video]"), gcap = document.querySelector("[data-recap-caption]");
  document.querySelectorAll(".recap-clip").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".recap-clip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      load(gv, b.getAttribute("data-src"), !b.hasAttribute("data-full"));
      gcap.innerHTML = b.getAttribute("data-title");
    });
  });

  // --- Win probability & game flow ---
  var wpCard = document.querySelector("[data-wp]");
  if (wpCard && timed.length) {
    var chart = wpCard.querySelector("[data-wp-chart]"), legend = wpCard.querySelector("[data-wp-legend]"), readout = wpCard.querySelector("[data-wp-readout]");
    var scoring = timed.filter(function (p) { return p.v > 0; });
    var first = scoring[0].x - 30, t1 = timed[timed.length - 1].x + 30, SIGMA = 12;
    function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
    function wpAt(m, x) { var r = Math.max(0, (t1 - x) / (t1 - first)); if (r <= 0.0001) return m > 0 ? 1 : m < 0 ? 0 : 0.5; return 0.5 * (1 + erf(m / (SIGMA * Math.sqrt(Math.min(1, r))) / Math.SQRT2)); }
    var pts = [{ x: first, s: [0, 0], p: null }].concat(scoring.map(function (p) { return { x: p.x, s: p.s, p: p }; }));
    pts.forEach(function (q) { q.wp = wpAt(q.s[0] - q.s[1], q.x); });
    pts.push({ x: t1, s: M.final, p: null, wp: M.final[0] > M.final[1] ? 1 : 0, end: true });
    var maxS = Math.ceil((Math.max(M.final[0], M.final[1]) + 10) / 25) * 25;
    var mode = "wp", W = 0, H = 230, PAD = { l: 50, r: 12, t: 10, b: 26 }, hover = -1;
    function X(x) { return PAD.l + (x - first) / (t1 - first) * (W - PAD.l - PAD.r); }
    function draw() {
      W = chart.clientWidth; if (!W) return;
      var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, s = "";
      function Y(v) { return mode === "wp" ? PAD.t + (1 - v) * ih : PAD.t + (1 - v / maxS) * ih; }
      s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (mode === "wp" ? "Estimated win probability over the game" : "Running score of both teams over the game") + '">';
      var ticks = mode === "wp" ? [[1, A + " 100%"], [0.75, "75%"], [0.5, "50%"], [0.25, "75%"], [0, B + " 100%"]] : [0, 0.25, 0.5, 0.75, 1].map(function (f) { return [f * maxS, String(f * maxS)]; });
      ticks.forEach(function (k) { var y = Y(k[0]); s += '<line class="' + (mode === "wp" && k[0] === 0.5 ? "mid" : "grid") + '" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (PAD.l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + k[1] + '</text>'; });
      for (var m = 600; m < t1; m += 600) { if (m < first) continue; var gx = X(m); if (gx > W - PAD.r - 70) continue; s += '<line class="grid" x1="' + gx + '" x2="' + gx + '" y1="' + PAD.t + '" y2="' + (H - PAD.b) + '" opacity=".5"/><text x="' + gx + '" y="' + (H - 8) + '" text-anchor="middle">' + mmss(m) + '</text>'; }
      s += '<text x="' + (W - PAD.r) + '" y="' + (H - 8) + '" text-anchor="end" font-weight="700">film time</text>';
      function stepPath(get) { var d = ""; pts.forEach(function (q, i) { var x = X(q.x), y = get(q); d += (i ? " H" + x.toFixed(1) + " V" + y.toFixed(1) : "M" + x.toFixed(1) + " " + y.toFixed(1)); }); return d; }
      if (mode === "wp") {
        var mid = Y(0.5), line = stepPath(function (q) { return Y(q.wp); }), area = line + " V" + mid + " H" + X(first) + " Z";
        s += '<defs><clipPath id="wpTop"><rect x="0" y="0" width="' + W + '" height="' + mid + '"/></clipPath><clipPath id="wpBot"><rect x="0" y="' + mid + '" width="' + W + '" height="' + (H - mid) + '"/></clipPath></defs>';
        s += '<path d="' + area + '" fill="' + M.tj.color + '" opacity=".28" clip-path="url(#wpTop)"/><path d="' + area + '" fill="' + M.opp.color + '" opacity=".28" clip-path="url(#wpBot)"/>';
        s += '<path class="line" d="' + line + '" stroke="var(--text-primary)"/>';
      } else {
        s += '<path class="line" d="' + stepPath(function (q) { return Y(q.s[1]); }) + '" stroke="' + M.opp.color + '"/>';
        s += '<path class="line" d="' + stepPath(function (q) { return Y(q.s[0]); }) + '" stroke="' + M.tj.color + '"/>';
      }
      if (hover >= 0) {
        var q = pts[hover], hx = X(q.x);
        s += '<line class="guide" x1="' + hx + '" x2="' + hx + '" y1="' + PAD.t + '" y2="' + (H - PAD.b) + '"/>';
        if (mode === "wp") s += '<circle cx="' + hx + '" cy="' + Y(q.wp) + '" r="5" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="2"/>';
        else s += '<circle cx="' + hx + '" cy="' + Y(q.s[0]) + '" r="4.5" fill="' + M.tj.color + '"/><circle cx="' + hx + '" cy="' + Y(q.s[1]) + '" r="4.5" fill="' + M.opp.color + '"/>';
      }
      s += '<rect x="' + PAD.l + '" y="0" width="' + iw + '" height="' + H + '" fill="transparent"/></svg>';
      chart.innerHTML = s;
      legend.innerHTML = '<span><i class="gc-dot" style="background:' + M.tj.color + '"></i>' + M.tj.name + (mode === "wp" ? " favored" : "") + '</span><span><i class="gc-dot" style="background:' + M.opp.color + '"></i>' + M.opp.name + (mode === "wp" ? " favored" : "") + '</span>';
    }
    function describe(i) {
      var q = pts[i], pct = Math.round(q.wp * 100), fav = pct >= 50 ? M.tj.name + " " + pct + "%" : M.opp.name + " " + (100 - pct) + "%";
      if (q.end) return "<b>Final: " + M.tj.name + " " + M.final[0] + ", " + M.opp.name + " " + M.final[1] + "</b>" + (M.ftNote ? " · " + M.ftNote : "");
      if (!q.p) return "<b>Tip-off</b> · 0–0 · win probability 50%";
      var lead = q.s[0] === q.s[1] ? "tied" : (q.s[0] > q.s[1] ? A : B) + " by " + Math.abs(q.s[0] - q.s[1]);
      return "<b>Film " + film(q.p.t) + "</b> · " + q.p.p + " (" + q.p.tm + ") " + q.p.d + " · <b>" + scoreTxt(q.s) + "</b> · " + (mode === "wp" ? "win probability " + fav + " (est.)" : lead) + " · click to watch";
    }
    function nearest(evt) {
      var r = chart.getBoundingClientRect(), x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - r.left, xs = first + (x - PAD.l) / (W - PAD.l - PAD.r) * (t1 - first), best = 0;
      pts.forEach(function (q, i) { if (q.x <= xs) best = i; });
      return best;
    }
    chart.addEventListener("pointermove", function (e) { var i = nearest(e); if (i !== hover) { hover = i; draw(); readout.innerHTML = describe(i); } });
    chart.addEventListener("click", function (e) {
      var q = pts[nearest(e)]; if (!q.p || !q.p.src) return;
      document.querySelectorAll(".recap-clip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      load(gv, q.p.src, true); gcap.textContent = q.p.p + " (" + TEAM[q.p.tm].name + ") " + q.p.d + " · Film " + film(q.p.t) + " · " + scoreTxt(q.p.s);
      gv.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    wpCard.querySelectorAll("[data-wp-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-wp-mode");
        wpCard.querySelectorAll("[data-wp-mode]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        draw(); if (hover >= 0) readout.innerHTML = describe(hover);
      });
    });
    if (window.ResizeObserver) new ResizeObserver(draw).observe(chart); else window.addEventListener("resize", draw);
    draw();
  }

  // --- Play-by-play tab ---
  var list = document.querySelector("[data-pbp-list]");
  if (list) {
    var filter = document.querySelector("[data-pbp-filter]"), count = document.querySelector("[data-pbp-count]");
    var pv = document.querySelector("[data-pbp-video]"), pcap = document.querySelector("[data-pbp-caption]");
    plays.forEach(function (p) {
      var li = document.createElement("li");
      li.className = "pbp-row" + (p.v ? " pbp-score" : "") + (p.src ? "" : " pbp-note"); li.setAttribute("data-tm", p.tm || "");
      var tTime = document.createElement("time"); tTime.textContent = p.t ? film(p.t) : "End";
      var tm = document.createElement("span"); tm.className = "pbp-tm";
      if (p.tm) { tm.innerHTML = '<i class="gc-dot" style="background:' + TEAM[p.tm].color + ';margin:0"></i>'; tm.appendChild(document.createTextNode(p.tm)); }
      var desc = document.createElement("span"); desc.className = "pbp-play";
      if (p.p) { var nm = document.createElement("b"); nm.textContent = p.p; desc.appendChild(nm); desc.appendChild(document.createTextNode(" ")); }
      desc.appendChild(document.createTextNode(p.d + (p.v ? " (+" + p.v + ")" : "")));
      var a = document.createElement("span"); a.className = "num" + (p.v && p.tm === A ? " hit" : ""); a.textContent = p.s[0];
      var b = document.createElement("span"); b.className = "num" + (p.v && p.tm === B ? " hit" : ""); b.textContent = p.s[1];
      var cell = document.createElement("span");
      if (p.src) {
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "pbp-watch"; btn.innerHTML = "&#9654;";
        btn.setAttribute("aria-label", "Watch: " + p.p + " " + p.d + ", film " + film(p.t));
        btn.addEventListener("click", function () {
          list.querySelectorAll(".is-playing").forEach(function (x) { x.classList.remove("is-playing"); });
          li.classList.add("is-playing"); load(pv, p.src, true);
          pcap.textContent = p.p + " (" + TEAM[p.tm].name + ") " + p.d + " · Film " + film(p.t) + " · " + scoreTxt(p.s);
          pv.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        cell = btn;
      }
      [tTime, tm, desc, a, b, cell].forEach(function (n) { li.appendChild(n); });
      list.appendChild(li);
    });
    function apply() {
      var v = filter.value, n = 0;
      list.querySelectorAll(".pbp-row").forEach(function (li) {
        var show = v === "all" || li.classList.contains("pbp-note") || (v === "score" ? li.classList.contains("pbp-score") : li.getAttribute("data-tm") === v);
        li.hidden = !show; if (show && !li.classList.contains("pbp-note")) n++;
      });
      count.textContent = n + " plays";
    }
    filter.addEventListener("change", apply); apply();
  }

  // --- Film room (Film tab) ---
  var fr = document.querySelector("[data-fr]");
  if (fr) {
    var fv = fr.querySelector("[data-fr-video]"), fList = fr.querySelector("[data-fr-list]"), fCount = fr.querySelector("[data-fr-count]");
    var fKicker = fr.querySelector("[data-fr-kicker]"), fTitle = fr.querySelector("[data-fr-title]"), fMeta = fr.querySelector("[data-fr-meta]");
    var fPrev = fr.querySelector("[data-fr-prev]"), fNext = fr.querySelector("[data-fr-next]"), fInGame = fr.querySelector("[data-fr-ingame]"), fAuto = fr.querySelector("[data-fr-auto]");
    var fPlayer = fr.querySelector("[data-fr-player]"), camBtns = fr.querySelectorAll("[data-fr-cam]");
    var chipK = "all", current = -1, visible = [], cam = M.defaultCam;
    var clips = timed.filter(function (p) { return p.src; });
    var names = {}; clips.forEach(function (p) { names[p.tm + "|" + p.p] = true; });
    Object.keys(names).sort().forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = k.split("|")[1] + " (" + k.split("|")[0] + ")"; fPlayer.appendChild(o); });
    function fullTitle() { fKicker.textContent = "Full game" + (M.cams.length > 1 ? " · " + M.cams[cam].label : ""); fTitle.textContent = M.title; fMeta.textContent = M.dateDay + " · " + M.fullLen + " · Final: " + A + " " + M.final[0] + ", " + B + " " + M.final[1]; }
    function markCams() { camBtns.forEach(function (b) { b.setAttribute("aria-pressed", +b.getAttribute("data-fr-cam") === cam && current < 0 ? "true" : "false"); }); }
    function item(i) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "fr-item"; b.setAttribute("data-i", i);
      var th = document.createElement("span"), tx = document.createElement("span"), title = document.createElement("b"), meta = document.createElement("span");
      tx.className = "fr-item-text"; meta.className = "muted";
      if (i < 0) {
        th.className = "fr-thumb fr-full"; th.style.background = "linear-gradient(135deg, " + M.tj.color + ", " + M.opp.color + ")"; th.innerHTML = "Full game<i>" + M.fullLen + "</i>";
        title.textContent = "Full game"; meta.textContent = M.title + " · Final " + M.final[0] + "–" + M.final[1];
      } else {
        var p = clips[i]; th.className = "fr-thumb";
        var img = document.createElement("img"); img.src = p.src.replace(/clip\.mp4$/, "clip.0000001.jpg"); img.alt = ""; img.loading = "lazy"; th.appendChild(img);
        var d = document.createElement("i"); d.textContent = "0:07"; th.appendChild(d);
        title.textContent = p.p + " " + p.d;
        meta.innerHTML = '<i class="gc-dot" style="background:' + TEAM[p.tm].color + '"></i>' + p.tm + " · Film " + film(p.t) + ' · <span class="fr-score">' + scoreTxt(p.s) + "</span>";
      }
      tx.appendChild(title); tx.appendChild(meta); b.appendChild(th); b.appendChild(tx); li.appendChild(b);
      b.addEventListener("click", function () { select(i, true); });
      return li;
    }
    function matches(p) {
      if (fPlayer.value && fPlayer.value !== p.tm + "|" + p.p) return false;
      if (chipK === "score") return p.v > 0;
      if (chipK === "three") return p.v === 3;
      if (chipK === A || chipK === B) return p.tm === chipK;
      return true;
    }
    function render() {
      fList.innerHTML = ""; visible = [];
      fList.appendChild(item(-1));
      clips.forEach(function (p, i) { if (matches(p)) { visible.push(i); fList.appendChild(item(i)); } });
      fCount.textContent = visible.length + (visible.length === 1 ? " play" : " plays") + " · in film order";
      mark();
    }
    function mark() {
      fList.querySelectorAll(".fr-item").forEach(function (b) { b.setAttribute("aria-current", +b.getAttribute("data-i") === current ? "true" : "false"); });
      var pos = visible.indexOf(current);
      fPrev.disabled = current < 0 || pos <= 0; fNext.disabled = current >= 0 ? pos < 0 || pos >= visible.length - 1 : !visible.length;
      fInGame.hidden = current < 0; markCams();
    }
    function select(i, autoplay) {
      current = i;
      if (i < 0) { load(fv, M.cams[cam].url, false); fullTitle(); }
      else {
        var p = clips[i]; load(fv, p.src, autoplay);
        fKicker.textContent = TEAM[p.tm].name + (p.v ? " · +" + p.v : ""); fTitle.textContent = p.p + " " + p.d;
        fMeta.textContent = "Film " + film(p.t) + " · " + scoreTxt(p.s);
      }
      mark();
      var cur = fList.querySelector('[aria-current="true"]'); if (cur) cur.scrollIntoView({ block: "nearest" });
    }
    function step(d) { var pos = visible.indexOf(current), n = current < 0 ? (d > 0 ? 0 : -1) : pos + d; if (n >= 0 && n < visible.length) select(visible[n], true); }
    fPrev.addEventListener("click", function () { step(-1); });
    fNext.addEventListener("click", function () { step(1); });
    fv.addEventListener("ended", function () { if (current >= 0 && fAuto.checked) step(1); });
    fInGame.addEventListener("click", function () {
      if (current < 0) return; var p = clips[current];
      cam = camOf(p.src); current = -1;
      load(fv, M.cams[cam].url, true, Math.max(0, p.x - 4)); fullTitle();
      fMeta.textContent = "Jumped to film " + film(p.t) + " · " + scoreTxt(p.s); mark();
    });
    camBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var at = current < 0 && !isNaN(fv.currentTime) ? fv.currentTime : 0, playing = current < 0 && !fv.paused;
        cam = +b.getAttribute("data-fr-cam"); current = -1;
        load(fv, M.cams[cam].url, playing, at); fullTitle(); mark();
      });
    });
    fr.querySelectorAll("[data-fr-chips] button").forEach(function (c) {
      c.addEventListener("click", function () { chipK = c.getAttribute("data-k"); fr.querySelectorAll("[data-fr-chips] button").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); }); render(); });
    });
    fPlayer.addEventListener("change", render);
    fullTitle(); render();
  }
// --- Shot chart (placeholder locations): every FGA from the box score on a full court; Team Jeremy shoots at the right basket, the opponent at the left ---
  var sc = document.querySelector("[data-sc]"), shotsEl = document.getElementById("shots-data");
  if (sc && shotsEl) {
    var shots = JSON.parse(shotsEl.textContent), court = sc.querySelector("[data-sc-court]"), sRead = sc.querySelector("[data-sc-readout]");
    var sTeam = "", sRes = sc.querySelector("[data-sc-result]"), sPl = sc.querySelector("[data-sc-player]");
    // deterministic placement (seeded by game + shot index): 2s inside the arc weighted toward the rim, 3s just beyond the line
    var seed = 0; (M.title + M.dateDay).split("").forEach(function (ch) { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
    function rng(n) { var t = (seed + n * 0x9E3779B9) >>> 0; return function () { t = (t + 0x6D2B79F5) >>> 0; var r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
    function isThree(dx, dy) { return dx <= 8.75 ? Math.abs(dy) >= 22 : Math.sqrt(dx * dx + dy * dy) >= 23.75; }
    shots.forEach(function (s, i) {
      var r = rng(i + 1), dx = 0, dy = 0;
      for (var tries = 0; tries < 200; tries++) {
        var th = (r() * 2 - 1) * (s.k === 3 ? 1.54 : 1.48), u = r(), dist;
        if (s.k === 3) dist = 23.9 + r() * 3.2; else dist = u < 0.5 ? r() * 6 : u < 0.78 ? 6 + r() * 8 : 14 + r() * 8.5;
        dx = dist * Math.cos(th); dy = dist * Math.sin(th);
        if (Math.abs(dy) < 24.2 && dx > -3.5 && (s.k === 3 ? isThree(dx, dy) && dx < 30 : !isThree(dx, dy))) break;
      }
      var left = s.tm !== A; s.cx = left ? 52.5 + dx * 10 : 887.5 - dx * 10; s.cy = 250 + dy * 10;
    });
    var pl = {}; shots.forEach(function (s) { pl[s.tm + "|" + s.p] = true; });
    Object.keys(pl).sort().forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = k.split("|")[1] + " (" + k.split("|")[0] + ")"; sPl.appendChild(o); });
    function half(flip) {
      var X = function (x) { return flip ? 940 - x : x; }, sweep = flip ? 0 : 1;
      return '<rect class="ln" x="' + Math.min(X(0), X(190)) + '" y="170" width="190" height="160"/>' +
        '<circle class="ln" cx="' + X(190) + '" cy="250" r="60"/>' +
        '<path class="ln" d="M' + X(0) + ' 30 H' + X(140) + ' A237.5 237.5 0 0 ' + sweep + ' ' + X(140) + ' 470 H' + X(0) + '"/>' +
        '<path class="ln" d="M' + X(52.5) + ' 210 A40 40 0 0 ' + sweep + ' ' + X(52.5) + ' 290"/>' +
        '<line class="ln" x1="' + X(40) + '" x2="' + X(40) + '" y1="220" y2="280"/><circle class="ln" cx="' + X(52.5) + '" cy="250" r="7.5"/>';
    }
    function shotTxt(s) { return s.p + " (" + s.tm + ") " + (s.m ? "made" : "missed") + " " + (s.k === 3 ? "3-pointer" : "2-pointer") + (s.t ? " \u00b7 Film " + film(s.t) + " \u00b7 click to watch" : " \u00b7 no film for this shot"); }
    function drawCourt() {
      var res = sRes.value, who = sPl.value, s = '<svg viewBox="0 0 940 500" role="img" aria-label="Shot chart with estimated locations">';
      s += '<rect class="court" x="1" y="1" width="938" height="498" rx="6"/><line class="ln" x1="470" x2="470" y1="0" y2="500"/><circle class="ln" cx="470" cy="250" r="60"/>' + half(false) + half(true);
      s += '<text x="20" y="490" fill="var(--text-muted)" font-size="18" font-weight="700">' + B + ' shoots \u2190</text><text x="920" y="490" text-anchor="end" fill="var(--text-muted)" font-size="18" font-weight="700">\u2192 ' + A + ' shoots</text>';
      var n = { a: [0, 0], b: [0, 0] };
      shots.forEach(function (sh, i) {
        var on = (!sTeam || sh.tm === sTeam) && (res === "" || String(sh.m) === res) && (!who || who === sh.tm + "|" + sh.p);
        if (on) { var key = sh.tm === A ? "a" : "b"; n[key][1]++; if (sh.m) n[key][0]++; }
        var col = TEAM[sh.tm].color, cls = "shot" + (sh.src ? " has-film" : "") + (on ? "" : " dim");
        s += '<g class="' + cls + '" data-i="' + i + '"><title>' + shotTxt(sh) + '</title>';
        if (sh.m) s += '<circle class="ring" cx="' + sh.cx.toFixed(1) + '" cy="' + sh.cy.toFixed(1) + '" r="8" fill="' + col + '" stroke="' + (sh.src ? "#fff" : col) + '" stroke-width="' + (sh.src ? 2 : 1) + '"/>';
        else s += '<circle class="ring" cx="' + sh.cx.toFixed(1) + '" cy="' + sh.cy.toFixed(1) + '" r="9" fill="transparent" stroke="transparent"/><path d="M' + (sh.cx - 6).toFixed(1) + ' ' + (sh.cy - 6).toFixed(1) + ' l12 12 m0 -12 l-12 12" stroke="' + col + '" stroke-width="' + (sh.src ? 3.5 : 2.2) + '" stroke-linecap="round" opacity="' + (sh.src ? 1 : .75) + '"/>';
        s += "</g>";
      });
      court.innerHTML = s + "</svg>";
      function line(code, v) { return '<span><i class="gc-dot" style="background:' + TEAM[code].color + '"></i>' + code + " " + v[0] + "-" + v[1] + (v[1] ? " (" + Math.round(100 * v[0] / v[1]) + "%)" : "") + "</span>"; }
      sc.querySelector("[data-sc-legend]").innerHTML = (sTeam !== B ? line(A, n.a) : "") + (sTeam !== A ? line(B, n.b) : "") + '<span>\u25CF made &middot; \u2715 missed &middot; white outline / bold = has film</span>';
    }
    court.addEventListener("mouseover", function (e) { var g = e.target.closest(".shot"); if (g && !g.classList.contains("dim")) sRead.textContent = shotTxt(shots[+g.getAttribute("data-i")]); });
    court.addEventListener("click", function (e) {
      var g = e.target.closest(".shot.has-film"); if (!g || g.classList.contains("dim")) return;
      var sh = shots[+g.getAttribute("data-i")];
      document.querySelectorAll(".recap-clip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      load(gv, sh.src, true); gcap.textContent = sh.p + " (" + TEAM[sh.tm].name + ") " + (sh.m ? "makes" : "misses") + " a " + (sh.k === 3 ? "3-pointer" : "2-pointer") + " \u00b7 Film " + film(sh.t);
      gv.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    sc.querySelectorAll("[data-sc-team]").forEach(function (b) {
      b.addEventListener("click", function () { sTeam = b.getAttribute("data-sc-team"); sc.querySelectorAll("[data-sc-team]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); drawCourt(); });
    });
    sRes.addEventListener("change", drawCourt); sPl.addEventListener("change", drawCourt);
    drawCourt();
  }
})();
</script>
