/* SGTBL auction draft: PROTOTYPE draft-room UI shared by admin/draft.html (role "admin") and captain/draft-room.html
   (role "coach", the Knicks). Uses window.SGTBLDraft (draft.js) and window.SGTBLReg (registrations.js).
   Layout (ESPN-style live auction room, user 2026-11-21): team strip, "on the block" hero with the clock, current bid and
   bid buttons, then the draft board, bid log and available players. Each region is only redrawn when its HTML changes,
   and clocks tick separately, so typing and photos aren't disturbed. */
(function () {
  var D = window.SGTBLDraft, R = window.SGTBLReg, esc = R.esc;
  var role = document.body.getAttribute("data-draft-role") || "coach", ME = D.ME, admin = role === "admin";
  var $ = function (s) { return document.querySelector(s); };
  var el = { teams: $("[data-dr-teams]"), photo: $("[data-dr-photo]"), main: $("[data-dr-main]"), bid: $("[data-dr-bidbox]"),
    extra: $("[data-dr-extra]"), scout: $("[data-dr-scout]"), board: $("[data-dr-board]"), log: $("[data-dr-log]"), pool: $("[data-dr-pool]") };
  var statusEl = $("[data-dr-status]"), toastEl = $("[data-rg-toast]");
  var posF = "all", starredOnly = false, q = "", sortBy = admin ? "name" : "scout";

  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, 4200); }
  function board() { try { return JSON.parse(localStorage.getItem("sgtbl-mock-board") || "[]"); } catch (e) { return []; } }
  function setBoard(b) { try { localStorage.setItem("sgtbl-mock-board", JSON.stringify(b)); } catch (e) {} }
  function done(err, ok) { if (err) toast(err); else if (ok) toast(ok); render(); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
  function level(r) { return { "College (varsity) or higher": "College varsity+", "College (club or intramural)": "College club", "High school": "High school", "Pickup / recreational": "Pickup / rec" }[r.level] || r.level || ""; }
  function posText(r) { return (r.pos || []).join(" / "); }
  // DRAFT ROOM ONLY (user, 2026-11-21): the six teams appear as NBA teams, with ESPN's logos. Underneath, the draft still
  // records the league's own team names (Knicks, Eagles, ...), so Registrations and the rest of the site are unchanged.
  // Logos are hot-linked from ESPN and shown only on localhost, like the mock headshots; elsewhere a team-color dot.
  var NBA = {
    Knicks: { name: "Knicks", abbr: "ny", color: "#006BB6" },
    Eagles: { name: "Celtics", abbr: "bos", color: "#007A33" },
    Sharks: { name: "Heat", abbr: "mia", color: "#98002E" },
    Wolves: { name: "Timberwolves", abbr: "min", color: "#236192" },
    Tigers: { name: "Lakers", abbr: "lal", color: "#552583" },
    Rams: { name: "Bulls", abbr: "chi", color: "#CE1141" }
  };
  function nba(t) { return NBA[t] || { name: t, abbr: "", color: "#64748b" }; }
  function tn(t) { return esc(nba(t).name); }
  function logo(t, cls) {
    var n = nba(t);
    return R.local && n.abbr ? '<img class="' + (cls || "dr-tlogo") + '" src="https://a.espncdn.com/i/teamlogos/nba/500/' + n.abbr + '.png" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : "";
  }
  function dot(t) { return logo(t) || '<span class="dr-team-dot" style="background:' + nba(t).color + '" aria-hidden="true"></span>'; }
  function tag(t) { return dot(t) + tn(t); }
  function the(t) { return "the " + tn(t); }
  function timer(ends) { return '<span data-dr-timer data-ends="' + ends + '"></span>'; }

  // ---- Private scouting reports (coaches only; user 2026-11-21): 8 skills rated 1-10 plus notes, kept per team.
  //      Only that team sees them; the League Admin doesn't. Prototype: saved in this browser. ----
  var SKILLS = [["sh", "Shooting"], ["fi", "Finishing"], ["bh", "Ball handling"], ["pa", "Passing"], ["re", "Rebounding"], ["de", "Defense"], ["at", "Athleticism"], ["iq", "Basketball IQ"]];
  var SCOUT_KEY = "sgtbl-mock-scouting";
  function scoutAll() { try { return JSON.parse(localStorage.getItem(SCOUT_KEY) || "{}"); } catch (e) { return {}; } }
  // PROTOTYPE (user, 2026-11-21): until real grades are entered before the draft, every player starts with SAMPLE grades,
  // worked out from their level, positions and height plus a little seeded variety. A grade the coach saves replaces them.
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var sampleCache = {};
  function sampleGrades(pid) {
    if (sampleCache[pid]) return sampleCache[pid];
    var p = D.player(pid); if (!p) return {};
    var base = { "College (varsity) or higher": 7.2, "College (club or intramural)": 6, "High school": 5, "Pickup / recreational": 3.8 }[p.level] || 5;
    var ht = String(p.ht || "6-0").split("-"), inches = (+ht[0] || 6) * 12 + (+ht[1] || 0), big = (inches - 74) / 3;
    var pos = p.pos || [], g = pos.indexOf("PG") >= 0 || pos.indexOf("SG") >= 0, f = pos.indexOf("SF") >= 0, b = pos.indexOf("PF") >= 0 || pos.indexOf("C") >= 0;
    var tilt = { sh: (g ? 1 : 0) + (f ? .5 : 0) - (b ? .8 : 0), fi: (b ? 1 : 0) + big * .3, bh: (g ? 1.4 : 0) - (b ? 1 : 0), pa: (pos.indexOf("PG") >= 0 ? 1.4 : g ? .6 : 0) - (b ? .5 : 0),
      re: (b ? 1.5 : 0) + big * .5 - (g ? .8 : 0), de: (f ? .5 : 0) + big * .2, at: (f ? .6 : 0) + (g ? .3 : 0), iq: (pos.indexOf("PG") >= 0 ? .8 : 0) };
    var h = hash(pid), out = {};
    SKILLS.forEach(function (k, i) { var noise = ((h >>> (i * 3)) & 7) / 7 * 2 - 1; out[k[0]] = Math.max(1, Math.min(10, Math.round(base + tilt[k[0]] + noise))); });
    return (sampleCache[pid] = out);
  }
  function scout(pid) {
    var a = scoutAll()[ME] || {}, x = a[pid];
    return x ? { r: x.r || {}, notes: x.notes || "" } : { r: sampleGrades(pid), notes: "", sample: true };
  }
  function saveScout(pid, rep) { var a = scoutAll(); a[ME] = a[ME] || {}; rep.at = Date.now(); a[ME][pid] = rep; try { localStorage.setItem(SCOUT_KEY, JSON.stringify(a)); } catch (e) {} }
  // Where each of a player's grades ranks in the draft pool (user, 2026-11-21): 1 = best; ties share a rank. Uses this
  // coach's grades (sample grades until they enter their own).
  var rankMemo = { key: "", map: {} };
  function rankMap(extraPid) {
    // Ranked against the WHOLE draft pool, drafted players included, so a player's rank stays the same all draft
    // (user, 2026-11-21); it only changes if the coach changes grades.
    var st = D.load(), ids = D.pool(st).map(function (r) { return r.id; });
    st.sales.forEach(function (x) { if (ids.indexOf(x.pid) < 0) ids.push(x.pid); });
    if (st.lot && ids.indexOf(st.lot.pid) < 0) ids.push(st.lot.pid);
    if (extraPid && ids.indexOf(extraPid) < 0) ids.push(extraPid);
    var key = ids.join(",") + "|" + (localStorage.getItem(SCOUT_KEY) || "");
    if (rankMemo.key === key) return rankMemo.map;
    var reps = {}, map = {};
    ids.forEach(function (id) { var x = scout(id); reps[id] = { r: x.r, tot: rated(x) ? total(x) : null }; });
    ids.forEach(function (id) {
      var me = reps[id], m = {};
      SKILLS.forEach(function (k) {
        var v = me.r[k[0]]; if (!v) return;
        m[k[0]] = 1 + ids.filter(function (o) { return (reps[o].r[k[0]] || 0) > v; }).length;
      });
      if (me.tot != null) m.tot = 1 + ids.filter(function (o) { return reps[o].tot != null && reps[o].tot > me.tot; }).length;
      map[id] = m;
    });
    rankMemo = { key: key, map: map };
    return map;
  }
  function ranksFor(pid) { return rankMap(pid)[pid] || {}; }
  function rk(n) { return n ? '(#' + n + ')' : ""; }
  function rated(rep) { return SKILLS.filter(function (k) { return rep.r[k[0]]; }).length; }
  function total(rep) { return SKILLS.reduce(function (m, k) { return m + (rep.r[k[0]] || 0); }, 0); }
  // Skill radar chart (user, 2026-11-21; replaced the grade bars): 8 axes, rings at 2/4/6/8/10, the coach's grades as a
  // filled shape. Unrated skills sit at the center. Labels carry the grade.
  var SHORT = { sh: "Shooting", fi: "Finishing", bh: "Handling", pa: "Passing", re: "Rebounding", de: "Defense", at: "Athletic", iq: "IQ" };
  function radar(rep, size, ranks) {
    var c = size / 2, R0 = size / 2 - 70, pt = function (i, v) { var a = -Math.PI / 2 + i * Math.PI / 4; return [c + Math.cos(a) * R0 * v / 10, c + Math.sin(a) * R0 * v / 10]; };
    var poly = function (vals) { return vals.map(function (v, i) { var p = pt(i, v); return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); };
    var vals = SKILLS.map(function (k) { return rep.r[k[0]] || 0; }), any = vals.some(function (v) { return v; });
    var g = '<svg class="dr-radar" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Scouting radar: ' + SKILLS.map(function (k, i) { return k[1] + " " + (vals[i] || "not rated"); }).join(", ") + '">';
    [2, 4, 6, 8, 10].forEach(function (lvl) { g += '<polygon points="' + poly(SKILLS.map(function () { return lvl; })) + '" class="dr-rd-ring' + (lvl === 10 ? " outer" : "") + '"/>'; });
    SKILLS.forEach(function (k, i) { var p = pt(i, 10); g += '<line x1="' + c + '" y1="' + c + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" class="dr-rd-axis"/>'; });
    if (any) {
      g += '<polygon points="' + poly(vals) + '" class="dr-rd-shape"/>';
      vals.forEach(function (v, i) { if (v) { var p = pt(i, v); g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" class="dr-rd-dot"/>'; } });
    }
    SKILLS.forEach(function (k, i) {
      var p = pt(i, 10), a = -Math.PI / 2 + i * Math.PI / 4, lx = c + Math.cos(a) * (R0 + 14), ly = c + Math.sin(a) * (R0 + 14);
      var anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end", dy = Math.sin(a) < -0.5 ? -14 : Math.sin(a) > 0.5 ? 10 : -4;
      g += '<text x="' + lx.toFixed(1) + '" y="' + (ly + dy).toFixed(1) + '" text-anchor="' + anchor + '" class="dr-rd-label">' + SHORT[k[0]] +
        '<tspan x="' + lx.toFixed(1) + '" dy="19" class="dr-rd-val' + (vals[i] ? "" : " none") + '">' + (vals[i] || "–") + '</tspan>' +
        (ranks && ranks[k[0]] ? '<tspan class="dr-rd-rank" dx="4">' + rk(ranks[k[0]]) + '</tspan>' : "") + '</text>';
    });
    return g + '</svg>';
  }
  // Coach's own scouting report for the player on the block, shown under the details (read-only; edit in the pop-up).
  function heroScout(r) {
    var rep = scout(r.id), n = rated(rep);
    var h = '<section class="dr-hs" aria-label="Your scouting report"><div class="dr-hs-head"><span class="dr-label">Your scouting report' + '</span>' +
      (n ? '<b>' + total(rep) + '<span>/80</span></b><em class="dr-rank">' + rk(ranksFor(r.id).tot) + ' in the pool</em>' + (n < 8 ? '<em>' + n + ' of 8 rated</em>' : "") : "") +
      '<button type="button" class="dr-hs-edit" data-dr-player="' + r.id + '">' + (n || rep.notes ? "Edit report" : "Rate this player") + '</button></div>';
    h += '<div class="dr-hs-body"><div class="dr-hs-radar">' + radar(rep, 300, ranksFor(r.id)) + '</div><div class="dr-hs-side">' +
      (n ? "" : '<p class="dr-hs-notes dr-muted">You haven’t rated this player yet. Rate the 8 skills (1 = weak, 10 = elite) to fill in the chart.</p>') +
      '<div class="dr-label">Notes</div>' +
      (rep.notes ? '<p class="dr-hs-notes">&ldquo;' + esc(rep.notes) + '&rdquo;</p>' : '<p class="dr-hs-notes dr-muted">No notes yet. Only your team sees your ratings and notes.</p>') +
      '</div></div>';
    return h + '</section>';
  }
  function scoutHeroHtml(st) {
    if (admin || !st.lot || (st.status !== "bidding" && st.status !== "review")) return "";
    var r = D.player(st.lot.pid); return r ? heroScout(r) : "";
  }
  function plink(r, html) { return '<button type="button" class="dr-plink" data-dr-player="' + r.id + '">' + (html || esc(r.first + " " + r.last)) + '</button>'; }

  // Replace a region's HTML only when it changed; keep focus and typed values in it.
  function set(node, html) {
    if (!node || node._h === html) return;
    var ae = document.activeElement, fid = ae && node.contains(ae) ? ae.id : "", keep = {};
    node.querySelectorAll("input[id], select[id]").forEach(function (i) { keep[i.id] = i.value; });
    node.innerHTML = html; node._h = html;
    Object.keys(keep).forEach(function (id) { var i = document.getElementById(id); if (i && id !== "drQ" && i.type !== "hidden") i.value = keep[id]; });
    if (fid) { var f = document.getElementById(fid); if (f) { f.focus(); if (fid === "drQ" && f.setSelectionRange) try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} } }
  }

  // ---- Team strip ----
  function teamsHtml(st) {
    var lot = st.lot, high = lot && st.status !== "nominate" ? lot.high.team : "", nom = st.status === "nominate" ? D.turnTeam(st) : lot ? lot.nominator : "";
    return st.order.map(function (t) {
      var full = D.spotsLeft(st, t) <= 0, cls = ["dr-tile", "dr-tc-" + t.toLowerCase()];
      if (t === high && st.status === "bidding") cls.push("high"); if (t === high && st.status === "review") cls.push("won");
      if (t === nom && st.status === "nominate") cls.push("nom"); if (!admin && t === ME) cls.push("me"); if (full) cls.push("full");
      var tag = t === high && st.status === "bidding" ? "High bid" : t === high && st.status === "review" ? "Winning" : t === nom && st.status === "nominate" ? "Nominating" : full ? "Full" : "";
      return '<div class="' + cls.join(" ") + '" style="--tc:' + nba(t).color + '"><div class="dr-tile-top"><b>' + logo(t, "dr-tile-logo") + tn(t) + (!admin && t === ME ? ' <span>(you)</span>' : "") + '</b></div>' +
        '<div class="dr-tile-money">' + money(D.budgetLeft(st, t)) + '</div><div class="dr-tile-sub">' + D.roster(st, t).length + '/' + D.SPOTS + ' · max ' + money(Math.max(0, D.maxBid(st, t))) + '</div>' + (tag ? '<em class="dr-tile-tag">' + tag + '</em>' : "") + '</div>';
    }).join("");
  }

  // ---- Hero: photo, main panel, bid box ----
  function photoHtml(st) {
    var r = st.lot && (st.status === "bidding" || st.status === "review") ? D.player(st.lot.pid) : null;
    if (!r) return '<div class="dr-photo-empty" aria-hidden="true"><img src="../assets/img/sgtbl-logo.svg" alt=""></div>';
    // The winning team's logo, faded, behind the cut-out headshot (user, 2026-11-21; like the public player page).
    // Its picture is set in render() so the headshot isn't redrawn every time the high bidder changes.
    return R.avatar(r, "xl").replace('</span><img', '</span><img class="dr-photo-team" alt="" hidden><img');
  }
  function photoTeam(st) {
    var bg = el.photo && el.photo.querySelector(".dr-photo-team"); if (!bg) return;
    // Only once bidding has closed (the player is won) and until the League Admin confirms the sale (user, 2026-11-21).
    var t = st.lot && st.status === "review" ? st.result.winner : "", n = t && nba(t);
    var src = n && n.abbr && R.local ? "https://a.espncdn.com/i/teamlogos/nba/500/" + n.abbr + ".png" : "";
    if (bg.getAttribute("src") !== src) { if (src) bg.setAttribute("src", src); else bg.removeAttribute("src"); }
    bg.hidden = !src;
  }

  function mainHtml(st) {
    var lot = st.lot;
    if (st.status === "setup") {
      if (!admin) return '<div class="dr-eyebrow">Auction draft</div><h2>The draft hasn’t started</h2><p>The League Admin starts the draft from the Draft Suite. Until then, look through the players below and star the ones you want to target. This page updates by itself when it begins.</p>';
      var n = D.pool(st).length, need = st.order.length * D.SPOTS;
      return '<div class="dr-eyebrow">Set up</div><h2>Start the auction draft</h2>' +
        '<div class="dr-setup"><div class="field"><label for="drSecs">Opening countdown for each player</label><select id="drSecs" class="input">' +
        [10, 20, 30, 45, 60, 90].map(function (s) { return '<option value="' + s + '"' + (s === st.secs ? " selected" : "") + '>' + s + ' seconds</option>'; }).join("") + '</select></div>' +
        '<div><div class="dr-label">Nomination order</div><ol class="dr-order-list">' + st.order.map(function (t) { return '<li>' + tag(t) + '</li>'; }).join("") + '</ol><button type="button" class="btn btn-sm dr-btn-ghost" data-dr="shuffle">Shuffle order</button></div></div>' +
        '<p class="dr-small">' + n + ' approved players for ' + need + ' roster spots.' + (n < need ? ' Approve ' + (need - n) + ' more on <a href="registrations.html">Registrations</a> to fill every roster (you can also do it while the draft runs).' : "") + '</p>' +
        '<div class="dr-row"><button type="button" class="btn dr-btn-primary" data-dr="start"' + (n ? "" : " disabled") + '>Start the draft</button><button type="button" class="btn dr-btn-ghost" data-dr="simulate">Simulate the whole draft (demo)</button></div>';
    }
    if (st.status === "nominate") {
      var t = D.turnTeam(st), mine = !admin && t === ME;
      var h = '<div class="dr-eyebrow">Lot ' + (st.sales.length + st.voided.length + 1) + ' · Nomination</div><h2>' + (mine ? "You’re on the clock" : tag(t) + " to nominate") + '</h2>';
      if (mine) h += '<p>Put a player up for auction; you open the bidding at $1. Use <b>Nominate</b> in the player list below, or choose here. If the clock runs out, your top starred player (or a random one) is nominated for you.</p>' + nomForm(st, t);
      else if (D.isBot(t)) h += '<p class="dr-muted">Simulated coach; they nominate in a few seconds.</p>';
      else h += '<p class="dr-muted">Waiting for their coach. If the clock runs out, a player is chosen for them.</p>';
      if (admin) h += '<div class="dr-subpanel"><div class="dr-label">Nominate for ' + the(t) + ' (if their coach is stuck)</div>' + nomForm(st, t) + '</div>';
      return h;
    }
    if (st.status === "bidding" || st.status === "review") {
      var r = D.player(lot.pid);
      if (!r) return '<p>Player not found.</p>';
      return '<div class="dr-eyebrow">On the block · Lot ' + lot.n + ' · Nominated by ' + the(lot.nominator) + (lot.auto ? ' (automatic)' : "") + '</div>' +
        '<div class="dr-name-row"><div class="dr-name-col"><h2 class="dr-name">' + plink(r, esc(r.first) + ' <b>' + esc(r.last) + '</b>') + '</h2>' +
        '<div class="dr-pos">' + esc((r.pos || []).map(function (p) { return R.POS[p] || p; }).join(" · ")) + '</div></div>' + winBadge(st) + '</div>' +
        '<dl class="dr-facts"><div><dt>Height</dt><dd>' + esc(R.fmtHt(r.ht)) + '</dd></div><div><dt>Shoots</dt><dd>' + esc(r.hand) + '</dd></div><div><dt>Level</dt><dd>' + esc(level(r)) + '</dd></div><div><dt>Will miss</dt><dd>' + esc(r.conflicts || "None listed") + '</dd></div></dl>';
    }
    if (st.status === "done") {
      var full = st.order.every(function (x) { return D.spotsLeft(st, x) <= 0; });
      var d = '<div class="dr-eyebrow">All lots sold</div><h2>' + (full ? "Every roster is full" : "The pool is empty") + '</h2>';
      if (!full) d += '<p>' + st.order.filter(function (x) { return D.spotsLeft(st, x) > 0; }).map(function (x) { return tn(x) + " need " + D.spotsLeft(st, x); }).join(", ") + ' more. ' + (admin ? 'Approve more players on <a href="registrations.html">Registrations</a> and the draft picks up again, or finish now.' : "The League Admin can approve more players.") + '</p>';
      d += admin ? '<p>Check the draft board, then lock the rosters. The league switches to the in-season phase and new sign-ups go to free agency.</p><div class="dr-row"><button type="button" class="btn dr-btn-primary" data-dr="finish">Lock rosters and finish the draft</button></div>' : '<p class="dr-muted">Waiting for the League Admin to lock the rosters.</p>';
      return d;
    }
    if (st.status === "final") return '<div class="dr-eyebrow">Draft complete</div><h2>Rosters are locked</h2><p>The league is in season. Players who register from now on go to the free-agent pool' + (admin ? "." : ' (see <a href="player-pool.html">Player Pool</a>).') + '</p>';
    return "";
  }

  // The team currently winning the player (the high bidder; the winner once bidding closes), shown to the right of the
  // player's name and position (user, 2026-11-21). ESPN logo on localhost; a team-color badge elsewhere.
  function winBadge(st) {
    var t = st.status === "review" ? st.result.winner : st.lot.high.team, n = nba(t);
    var art = logo(t, "dr-win-logo") || '<span class="dr-win-dot" style="background:' + n.color + '">' + esc(n.name.charAt(0)) + '</span>';
    return '<div class="dr-win" style="--tc:' + n.color + '"><span class="dr-win-art">' + art + '</span><span class="dr-win-txt"><em>' + (st.status === "review" ? "Sold to" : "Winning") + '</em><b>' + tn(t) + (t === ME && !admin ? " (you)" : "") + '</b></span></div>';
  }
  function nomForm(st, team) {
    // Only players still in the pool (drafted players and the one on the block are left out). Coaches see them best
    // first by their own scouting total (user, 2026-11-21); the League Admin, who has no grades, sees them by name.
    var byName = function (a, b) { return (a.last + a.first).localeCompare(b.last + b.first); };
    var p = D.pool(st), tot = function (r) { var x = scout(r.id); return rated(x) ? total(x) : -1; };
    p.sort(admin ? byName : function (a, b) { return tot(b) - tot(a) || byName(a, b); });
    return '<div class="dr-row"><label class="sr-only" for="drNom' + (admin ? "A" : "") + '">Player to nominate</label><select id="drNom' + (admin ? "A" : "") + '" class="input"><option value="">Choose a player' + (admin ? "" : " (best grade first)") + '</option>' +
      p.map(function (r) {
        var t = admin ? -1 : tot(r);
        return '<option value="' + r.id + '">' + esc((t >= 0 ? t + " (#" + ranksFor(r.id).tot + ") · " : "") + r.first + " " + r.last + " · " + posText(r)) + '</option>';
      }).join("") +
      '</select><button type="button" class="btn dr-btn-primary" data-dr="nominate" data-team="' + esc(team) + '">Nominate' + (admin ? " for " + the(team) : "") + '</button></div>';
  }

  // Overbid protection: the 1-second grey-out starts when this screen first shows a new high bid (or when it was
  // placed, if later), so a coach always gets the full second to see the new price.
  var seenHigh = { key: "", at: 0 };
  function coolEnd(lot) {
    var key = lot.n + "|" + lot.bids.length;
    if (seenHigh.key !== key) seenHigh = { key: key, at: Date.now() };
    return Math.max(lot.high.at, seenHigh.at) + D.COOLDOWN;
  }
  // Quick bid amounts: the minimum, then a few round jumps, all within your max.
  function quickBids(st, lot) {
    var min = D.minNext(lot), max = D.maxBid(st, ME), out = [min];
    [5, 10, 25, 50].forEach(function (j) { var a = lot.high.amt + j; if (a > min && a <= max && out.indexOf(a) < 0) out.push(a); });
    return out.filter(function (a) { return a <= max; }).slice(0, 4);
  }

  function bidHtml(st) {
    var lot = st.lot;
    if (st.status === "nominate") return '<div class="dr-clock-label">Nomination clock</div><div class="dr-clock">' + timer(st.turnAt + (D.isBot(D.turnTeam(st)) ? D.NOM_DELAY : D.NOM_LIMIT)) + '</div>';
    if (st.status === "bidding") {
      var h = '<div class="dr-clock-label">' + (st.paused ? "Paused" : "Time left") + '</div><div class="dr-clock">' + timer(lot.endsAt) + '</div>' +
        '<div class="dr-current"><span>Current bid</span><strong>' + money(lot.high.amt) + '</strong><em>' + tag(lot.high.team) + (lot.high.team === ME && !admin ? " (you)" : "") + '</em></div>' +
        '<div class="dr-next">Next bid at least <b>' + money(D.minNext(lot)) + '</b> · raises of $' + D.raise(lot.high.amt) + ' at this price</div>';
      if (admin) return h + '<div class="dr-row"><button type="button" class="btn btn-sm dr-btn-ghost" data-dr="void">Cancel this lot</button></div>';
      if (lot.teams.indexOf(ME) < 0) return h + '<p class="dr-muted dr-small">Your roster is full.</p>';
      if (lot.high.team === ME) return h + '<div class="dr-youhigh">You’re the high bidder</div>';
      var mb = D.maxBid(st, ME), min = D.minNext(lot), coolUntil = coolEnd(lot), cool = Date.now() < coolUntil && !st.paused, off = st.paused || min > mb || cool;
      h += (cool ? '<div class="dr-cool" data-cool-until="' + coolUntil + '" role="status"><span class="dr-cool-txt">New price. Check it before you bid</span><span class="dr-cool-bar"><i></i></span></div>' : "") +
        '<div class="dr-quick">' + quickBids(st, lot).map(function (a, i) { return '<button type="button" class="btn ' + (i ? "dr-btn-ghost" : "dr-btn-bid") + '" data-dr="bid" data-amt="' + a + '" data-seen="' + lot.high.amt + '"' + (off ? " disabled" : "") + '>' + (i ? "" : "Bid ") + money(a) + '</button>'; }).join("") + '</div>' +
        '<form class="dr-row dr-custom" data-dr-bidform data-seen="' + lot.high.amt + '"><label class="sr-only" for="drBid">Your bid</label><span class="dr-dollar">$</span><input id="drBid" class="input" type="number" inputmode="numeric" min="' + min + '" max="' + mb + '" step="1" placeholder="' + min + '"' + (st.paused || min > mb ? " disabled" : "") + '><button class="btn dr-btn-ghost" type="submit"' + (off ? " disabled" : "") + '>Bid</button></form>' +
        '<div class="dr-small dr-muted">' + (min > mb ? "This is above your max bid of " + money(mb) + "." : "Your max bid: " + money(mb) + " (you keep $1 for each other open spot).") + '</div>';
      return h;
    }
    if (st.status === "review") {
      var res = st.result;
      return '<div class="dr-clock-label">Bidding closed</div><div class="dr-sold">Sold</div>' +
        '<div class="dr-current"><span>Winning bid</span><strong>' + money(res.price) + '</strong><em>' + tag(res.winner) + (res.winner === ME && !admin ? " (you)" : "") + '</em></div>' +
        (admin ? '<div class="dr-row"><button type="button" class="btn dr-btn-primary" data-dr="confirm">Confirm sale</button><button type="button" class="btn dr-btn-ghost" data-dr="void">Void</button></div><div class="dr-small dr-muted">Confirming adds the player to ' + the(res.winner) + '’ roster and passes the nomination on. Voiding sends the player back to the pool.</div>'
          : '<div class="dr-small dr-muted">Waiting for the League Admin to confirm.</div>');
    }
    if (st.status === "setup") return '<div class="dr-rules"><div class="dr-label">How it works</div><ul><li>' + money(D.BUDGET) + ' to fill ' + D.SPOTS + ' spots</li><li>Coaches take turns nominating (' + D.NOM_LIMIT / 1000 + ' s); opening bid $1</li><li>Open bidding: raise by $1 under $50, $5 to $200, $10 above</li><li>Each new high bid puts the clock back to 10 s</li><li>The League Admin confirms each sale</li></ul></div>';
    return "";
  }

  function extraHtml(st) {
    if (st.status !== "nominate" && st.status !== "bidding") return "";
    var h = st.paused ? '<div class="dr-paused" role="status"><b>Paused by the commissioner.</b> Every clock is stopped' + (admin ? "." : "; bidding and nominations open again when the draft resumes.") + '</div>' : "";
    if (admin) h += '<div class="dr-commish"><span class="dr-label">Commissioner clock</span>' +
      (st.paused ? '<button type="button" class="btn btn-sm dr-btn-primary" data-dr="resume">Resume clock</button>' : '<button type="button" class="btn btn-sm dr-btn-ghost" data-dr="pause">Pause clock</button>') +
      '<label class="dr-add"><span>Add</span><input id="drAdd" class="input" type="number" inputmode="numeric" min="1" max="600" step="1" value="15" aria-label="Seconds to add"><span>s</span></label>' +
      '<button type="button" class="btn btn-sm dr-btn-ghost" data-dr="addtime">Add time</button><span class="dr-muted dr-small">to the ' + (st.status === "bidding" ? "bidding" : "nomination") + ' clock, for everyone</span></div>';
    return h;
  }

  // ---- Draft board: one column per team, one slot per roster spot ----
  function boardHtml(st) {
    return '<div class="dr-board-grid" style="grid-template-columns:repeat(' + st.order.length + ',minmax(140px,1fr))">' + st.order.map(function (t) {
      var ro = D.roster(st, t), slots = [];
      for (var i = 0; i < D.SPOTS; i++) {
        var s = ro[i], r = s && D.player(s.pid);
        slots.push(s ? '<li title="' + esc(s.name + " · " + money(s.price)) + '">' + (r ? R.avatar(r, "xs") : "") + '<span class="dr-slot-txt">' + (r ? plink(r) : esc(s.name)) + '<span class="dr-slot-meta"><em>' + esc(r ? posText(r) : "") + '</em><b>' + money(s.price) + '</b></span></span></li>' : '<li class="empty"><span class="dr-slot-txt">Open spot</span></li>');
      }
      return '<div class="dr-col' + (!admin && t === ME ? " me" : "") + '"><div class="dr-col-head" style="--tc:' + nba(t).color + '"><span class="dr-col-txt"><b>' + tn(t) + '</b><span>' + money(D.budgetLeft(st, t)) + ' left</span></span>' + logo(t, "dr-col-logo") + '</div><ol>' + slots.join("") + '</ol></div>';
    }).join("") + '</div>';
  }

  // ---- Bid log for the player on the block + recent sales ----
  function logHtml(st) {
    var lot = st.lot, a = "", b = "";
    if (lot && (st.status === "bidding" || st.status === "review")) {
      a = '<div class="dr-label">Bids on this player</div><ol class="dr-bidlog">' + lot.bids.slice().reverse().slice(0, 10).map(function (x, i) {
        return '<li' + (i === 0 ? ' class="top"' : "") + '>' + dot(x.team) + '<span class="dr-bl-team">' + tn(x.team) + (x.opening ? ' <em>opened</em>' : "") + '</span><b>' + money(x.amt) + '</b></li>';
      }).join("") + '</ol>';
    } else a = '<div class="dr-label">Bids on this player</div><p class="dr-muted dr-small">Bids show here once a player is on the block.</p>';
    var sales = st.sales.slice().reverse().slice(0, 10);
    b = '<div class="dr-label">Recent sales</div>' + (sales.length ? '<ol class="dr-sales">' + sales.map(function (s) {
      var r = D.player(s.pid);
      return '<li>' + (r ? R.avatar(r, "sm") : "") + '<span class="dr-sale-txt"><b>' + (r ? plink(r) : esc(s.name)) + '</b><em>' + tag(s.team) + '</em></span><strong>' + money(s.price) + '</strong></li>';
    }).join("") + '</ol>' : '<p class="dr-muted dr-small">No players sold yet.</p>');
    if (st.voided.length) b += '<p class="dr-muted dr-small">Voided: ' + st.voided.map(function (v) { return esc(v.name); }).join(", ") + '</p>';
    return '<div class="dr-log-col">' + a + '</div><div class="dr-log-col">' + b + '</div>';
  }

  // ---- Available players ----
  function poolHtml(st) {
    var list = D.pool(st), b = board(), canNom = st.status === "nominate" && !st.paused && (admin || D.turnTeam(st) === ME), nomTeam = D.turnTeam(st);
    var P = [["all", "All"], ["PG", "PG"], ["SG", "SG"], ["SF", "SF"], ["PF", "PF"], ["C", "C"]];
    var chips = P.map(function (p) {
      var n = p[0] === "all" ? list.length : list.filter(function (r) { return r.pos.indexOf(p[0]) >= 0; }).length;
      return '<button type="button" class="dr-chip" aria-pressed="' + (posF === p[0]) + '" data-dr-pos="' + p[0] + '">' + p[1] + ' <b>' + n + '</b></button>';
    }).join("") + (admin ? "" : '<button type="button" class="dr-chip" aria-pressed="' + starredOnly + '" data-dr-starred>★ Starred <b>' + list.filter(function (r) { return b.indexOf(r.id) >= 0; }).length + '</b></button>');
    var shown = list.filter(function (r) { return posF === "all" || r.pos.indexOf(posF) >= 0; })
      .filter(function (r) { return !starredOnly || b.indexOf(r.id) >= 0; })
      .filter(function (r) { return !q || (r.first + " " + r.last).toLowerCase().indexOf(q) >= 0; })
      .sort(sorter());
    var rows = shown.map(function (r) {
      var star = b.indexOf(r.id) >= 0;
      return '<tr><td><span class="dr-who">' + R.avatar(r, "sm") + '<b>' + plink(r) + '</b></span></td>' + (admin ? "" : scoutCell(r)) + '<td>' + esc(posText(r)) + '</td><td>' + esc(R.fmtHt(r.ht)) + '</td><td>' + esc(r.hand) + '</td><td>' + esc(level(r)) + '</td><td class="dr-miss">' + esc(r.conflicts || "—") + '</td><td class="dr-act">' +
        (admin ? "" : '<button type="button" class="dr-star" aria-pressed="' + star + '" aria-label="' + (star ? "Remove from" : "Add to") + ' draft board" data-dr-star="' + r.id + '">' + (star ? "★" : "☆") + '</button>') +
        (canNom ? '<button type="button" class="btn btn-sm dr-btn-primary" data-dr="nominate" data-pid="' + r.id + '" data-team="' + esc(nomTeam) + '">Nominate</button>' : "") + '</td></tr>';
    }).join("");
    return '<div class="dr-tools"><div class="dr-chips" role="group" aria-label="Filter by position">' + chips + '</div><label for="drQ" class="sr-only">Search players</label><div class="dr-tools-r"><label for="drSort" class="sr-only">Sort players</label><select id="drSort" class="input dr-sort">' +
      (admin ? "" : '<option value="scout"' + (sortBy === "scout" ? " selected" : "") + '>Sort: your scouting total</option>') +
      '<option value="name"' + (sortBy === "name" ? " selected" : "") + '>Sort: name</option><option value="ht"' + (sortBy === "ht" ? " selected" : "") + '>Sort: height</option></select>' +
      '<input id="drQ" class="input dr-search" type="search" placeholder="Search players" value="' + esc(q) + '"></div></div>' +
      '<div class="dr-table-wrap"><table class="dr-table"><thead><tr><th>Player</th>' + (admin ? "" : '<th title="Your private scouting total: 8 skills, 1 to 10 each">Your scout</th>') + '<th>Pos</th><th>Ht</th><th>Shoots</th><th>Level</th><th>Will miss</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="' + (admin ? 7 : 8) + '" class="dr-muted">No available players match.</td></tr>') + '</tbody></table></div>';
  }

  function inches(r) { var p = String(r.ht || "0-0").split("-"); return (+p[0] || 0) * 12 + (+p[1] || 0); }
  function sorter() {
    var byName = function (x, y) { return (x.last + x.first).localeCompare(y.last + y.first); };
    if (sortBy === "ht") return function (x, y) { return inches(y) - inches(x) || byName(x, y); };
    if (sortBy === "scout" && !admin) {
      var tot = function (r) { var x = scout(r.id); return rated(x) ? total(x) : -1; };
      return function (x, y) { return tot(y) - tot(x) || byName(x, y); };   // highest total first; unrated players last
    }
    return byName;
  }
  function scoutCell(r) {
    var rep = scout(r.id), n = rated(rep);
    return '<td class="dr-scout">' + (n ? '<b>' + total(rep) + '</b><span>/80</span> <span class="dr-rk">' + rk(ranksFor(r.id).tot) + '</span>' + (n < 8 ? '<em>' + n + ' of 8</em>' : "") : '<span class="dr-muted">Not rated</span>') +
      (rep.notes ? ' <i title="You have notes on this player" aria-label="Has notes">&#9998;</i>' : "") + '</td>';
  }

  // ---- Player pop-up: details, where the player stands, and (coaches) a private scouting report ----
  document.body.insertAdjacentHTML("beforeend", '<dialog class="dr-pdlg" id="drPlayer" aria-labelledby="drPName"><button type="button" class="dr-pdlg-x" data-dr-close aria-label="Close">&#10005;</button><div data-dr-pbody></div></dialog>');
  var dlg = document.getElementById("drPlayer"), dlgBody = dlg.querySelector("[data-dr-pbody]"), openPid = "", saveT;
  function pstatusHtml(st, r) {
    var sale = st.sales.filter(function (x) { return x.pid === r.id; })[0], lot = st.lot, h = "";
    if (sale) h = '<span class="dr-pill">Drafted</span> ' + tag(sale.team) + ' for <b>' + money(sale.price) + '</b>';
    else if (lot && lot.pid === r.id && st.status === "bidding") h = '<span class="dr-pill live">On the block</span> High bid <b>' + money(lot.high.amt) + '</b> by ' + tag(lot.high.team);
    else if (lot && lot.pid === r.id && st.status === "review") h = '<span class="dr-pill live">Sold</span> to ' + tag(st.result.winner) + ' for <b>' + money(st.result.price) + '</b>, waiting for League Admin';
    else if (r.status === "approved") h = '<span class="dr-pill">Available</span> In the draft pool';
    else h = '<span class="dr-pill">' + esc(r.status) + '</span>';
    var acts = "";
    if (!admin && !sale && !(lot && lot.pid === r.id)) {
      var star = board().indexOf(r.id) >= 0;
      acts += '<button type="button" class="btn btn-sm dr-btn-ghost" data-dr-star="' + r.id + '">' + (star ? "★ On your board" : "☆ Add to your board") + '</button>';
    }
    if (st.status === "nominate" && !st.paused && !sale && r.status === "approved" && (admin || D.turnTeam(st) === ME))
      acts += '<button type="button" class="btn btn-sm dr-btn-primary" data-dr="nominate" data-pid="' + r.id + '" data-team="' + esc(D.turnTeam(st)) + '">Nominate' + (admin ? " for " + the(D.turnTeam(st)) : "") + '</button>';
    return '<div class="dr-pstatus-line">' + h + '</div>' + (acts ? '<div class="dr-row">' + acts + '</div>' : "");
  }
  function scoutTotalText(rep, ranks) { var n = rated(rep); return n ? "Total " + total(rep) + " / 80" + (ranks && ranks.tot ? " " + rk(ranks.tot) + " in the pool" : "") + (n < 8 ? " · " + n + " of 8 skills rated" : "") : "Not rated yet"; }
  function openPlayer(pid) {
    var r = D.player(pid), st = D.load(); if (!r) return;
    openPid = pid;
    var h = '<div class="dr-phead">' + R.avatar(r, "lg") + '<div><div class="dr-eyebrow">' + esc((r.pos || []).map(function (p) { return R.POS[p] || p; }).join(" · ")) + '</div><h2 id="drPName">' + esc(r.first + " " + r.last) + '</h2>' +
      (r.svId ? '<a href="https://uh.sportsvisio.com/league/texas-frisco/player/' + esc(r.svId) + '" target="_blank" rel="noopener">SportsVisio stats &rarr;</a>' : '<span class="dr-muted dr-small">No SportsVisio profile linked yet</span>') + '</div></div>' +
      '<dl class="dr-facts"><div><dt>Height</dt><dd>' + esc(R.fmtHt(r.ht)) + '</dd></div><div><dt>Shoots</dt><dd>' + esc(r.hand) + '</dd></div><div><dt>Level</dt><dd>' + esc(level(r)) + '</dd></div><div><dt>Will miss</dt><dd>' + esc(r.conflicts || "None listed") + '</dd></div></dl>' +
      '<div class="dr-pstatus" data-dr-pstatus></div>';
    if (admin) h += '<p class="dr-muted dr-small">Coaches keep their own scouting ratings and notes on each player. They are private to each team, so they don\u2019t appear here.</p>';
    else {
      var rep = scout(pid);
      h += '<section class="dr-scouting"><div class="dr-scout-head"><h3>Your scouting report' + '</h3><span data-dr-stotal' + (rated(rep) ? "" : ' class="none"') + '>' + scoutTotalText(rep, ranksFor(pid)) + '</span></div>' +
        '<div class="dr-scout-grid"><div class="dr-scout-radar" data-dr-radar>' + radar(rep, 280, ranksFor(pid)) + '</div><div class="dr-skills">' + SKILLS.map(function (k) {
          var v = rep.r[k[0]] || "";
          return '<label class="dr-skill"><span>' + k[1] + '</span><select class="input" data-skill="' + k[0] + '" aria-label="' + k[1] + ' grade"><option value="">&ndash;</option>' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option' + (n === v ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select><em class="dr-skill-rank" data-rank-of="' + k[0] + '">' + rk(ranksFor(pid)[k[0]]) + '</em></label>';
        }).join("") + '</div></div>' +
        '<label class="dr-notes-l" for="drSNotes">Notes</label><textarea id="drSNotes" class="input dr-notes" rows="4" placeholder="Optional: strengths, fit with your roster, availability concerns, the most you\u2019d pay\u2026">' + esc(rep.notes) + '</textarea>' +
        '<p class="dr-muted dr-small">1 = weak, 10 = elite. Only the ' + tn(ME) + ' can see your ratings and notes. They save as you go, and the player list sorts by your total.</p></section>';
    }
    dlgBody.innerHTML = h;
    var ps = dlgBody.querySelector("[data-dr-pstatus]"); ps._h = ""; set(ps, pstatusHtml(st, r));
    if (!dlg.open) dlg.showModal();
  }
  function saveFromDialog() {
    if (!openPid || admin) return;
    var rep = { r: {}, notes: (document.getElementById("drSNotes") || {}).value || "" };
    dlgBody.querySelectorAll("[data-skill]").forEach(function (sel) { if (sel.value) rep.r[sel.getAttribute("data-skill")] = +sel.value; });
    saveScout(openPid, rep);
    var rks = ranksFor(openPid), rd = dlgBody.querySelector("[data-dr-radar]"); if (rd) rd.innerHTML = radar(rep, 280, rks);
    dlgBody.querySelectorAll("[data-rank-of]").forEach(function (e) { e.textContent = rk(rks[e.getAttribute("data-rank-of")]); });
    var t = dlgBody.querySelector("[data-dr-stotal]"); if (t) { t.textContent = scoutTotalText(rep, rks); t.classList.toggle("none", !rated(rep)); }
    render();
  }
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest("[data-dr-close]")) dlg.close(); });
  dlg.addEventListener("close", function () { if (saveT) { clearTimeout(saveT); saveFromDialog(); } openPid = ""; });
  dlg.addEventListener("change", function (e) {
    if (!e.target.matches("[data-skill]")) return;
    saveFromDialog();
  });
  dlg.addEventListener("input", function (e) { if (e.target.id === "drSNotes") { clearTimeout(saveT); saveT = setTimeout(function () { saveT = null; saveFromDialog(); }, 400); } });

  function statusText(st) {
    if (st.paused && (st.status === "nominate" || st.status === "bidding")) return "Paused";
    return { setup: "Not started", nominate: "Live · nominating", bidding: "Live · bidding", review: admin ? "Live · confirm sale" : "Live · awaiting admin", done: "All lots sold", final: "Complete" }[st.status] || "";
  }

  function render() {
    var st = D.load();
    if (D.step(st, Date.now())) D.save(st);
    var now = st.paused || Date.now();                               // clocks freeze while paused
    set(el.teams, teamsHtml(st)); set(el.photo, photoHtml(st)); photoTeam(st); set(el.main, mainHtml(st)); set(el.bid, bidHtml(st));
    set(el.extra, extraHtml(st)); set(el.scout, scoutHeroHtml(st)); set(el.board, boardHtml(st)); set(el.log, logHtml(st)); set(el.pool, poolHtml(st));
    if (dlg.open && openPid) { var pr = D.player(openPid); if (pr) set(dlgBody.querySelector("[data-dr-pstatus]"), pstatusHtml(st, pr)); }
    var hero = $(".dr-hero"); if (hero) { hero.classList.toggle("is-review", st.status === "review"); hero.classList.toggle("is-paused", !!st.paused); }
    if (statusEl) { statusEl.textContent = statusText(st); statusEl.className = "badge " + (st.paused ? "badge-warning" : st.status === "final" ? "badge-success" : st.status === "setup" ? "badge-info" : st.status === "done" ? "badge-warning" : "badge-live"); }
    document.querySelectorAll("[data-dr-timer]").forEach(function (t) {
      var left = +t.getAttribute("data-ends") - now; t.textContent = mmss(left);
      var c = t.closest(".dr-clock"); if (c) c.classList.toggle("low", left <= 5000);
    });
    // Overbid protection: the 1-second bar fills while the bid buttons are greyed out.
    document.querySelectorAll("[data-cool-until]").forEach(function (c) {
      var f = Math.min(1, Math.max(0, 1 - (+c.getAttribute("data-cool-until") - Date.now()) / D.COOLDOWN)), i = c.querySelector("i");
      if (i) i.style.transform = "scaleX(" + f.toFixed(3) + ")";
    });
  }

  function doBid(amt, seen) {
    var err = D.bid(ME, amt, seen);
    if (!err) { var i = document.getElementById("drBid"); if (i) i.value = ""; }
    done(err, err ? "" : "You bid $" + amt + ".");
  }

  document.addEventListener("click", function (e) {
    var pl = e.target.closest("[data-dr-player]"); if (pl) return openPlayer(pl.getAttribute("data-dr-player"));
    var b = e.target.closest("[data-dr]");
    if (b) {
      var k = b.getAttribute("data-dr");
      if (k === "shuffle") return done(D.shuffle());
      if (k === "start") return done(D.start(), "Draft started. The " + nba(D.load().order[0]).name + " nominate first.");
      if (k === "simulate") { if (!confirm("Play out the whole draft instantly with simulated bidding for every team (the Knicks included)? Use “Reset draft” to undo.")) return; return done(D.simulate(), "Draft simulated. Check the draft board, then lock the rosters."); }
      if (k === "nominate") {
        var sel = b.parentNode.querySelector("select"), pid = b.getAttribute("data-pid") || (sel && sel.value), team = b.getAttribute("data-team");
        if (!pid) return toast("Choose a player to nominate.");
        var r = D.player(pid), err = D.nominate(pid, team); if (!err && dlg.open) dlg.close();
        return done(err, (r ? r.first + " " + r.last : "Player") + " is on the block.");
      }
      if (k === "bid") return doBid(+b.getAttribute("data-amt"), +b.getAttribute("data-seen"));
      if (k === "pause") return done(D.pause(), "Clock paused for everyone.");
      if (k === "resume") return done(D.resume(), "Clock resumed.");
      if (k === "addtime") { var sec = parseInt((document.getElementById("drAdd") || {}).value, 10); return done(D.addTime(sec), "Added " + sec + " seconds."); }
      if (k === "confirm") { var st = D.load(), res = st.result; return done(D.confirm(), res ? "Sale confirmed: " + nba(res.winner).name + ", $" + res.price + "." : ""); }
      if (k === "void") { if (!confirm("Void this lot? The player goes back to the pool and the same team nominates again.")) return; return done(D.voidLot(), "Lot voided. The player is back in the pool."); }
      if (k === "finish") { if (!confirm("Lock every roster and finish the draft? The league switches to the in-season phase.")) return; return done(D.finish(), "Draft complete. Rosters are locked."); }
      if (k === "reset") { if (!confirm("Reset the draft? Every drafted player goes back to the pool.")) return; D.reset(); return done("", "Draft reset."); }
    }
    var p = e.target.closest("[data-dr-pos]"); if (p) { posF = p.getAttribute("data-dr-pos"); return render(); }
    if (e.target.closest("[data-dr-starred]")) { starredOnly = !starredOnly; return render(); }
    var s = e.target.closest("[data-dr-star]");
    if (s) { var id = s.getAttribute("data-dr-star"), bd = board(), i = bd.indexOf(id); if (i >= 0) bd.splice(i, 1); else bd.push(id); setBoard(bd); render(); if (dlg.open && openPid) { var sp = D.player(openPid); if (sp) set(dlgBody.querySelector("[data-dr-pstatus]"), pstatusHtml(D.load(), sp)); } }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "drSecs") done(D.setSecs(+e.target.value));
    if (e.target.id === "drSort") { sortBy = e.target.value; render(); }
  });
  document.addEventListener("input", function (e) { if (e.target.id === "drQ") { q = e.target.value.trim().toLowerCase(); render(); } });
  document.addEventListener("submit", function (e) {
    if (!e.target.matches("[data-dr-bidform]")) return;
    e.preventDefault();
    var v = parseInt(document.getElementById("drBid").value, 10);
    if (!(v > 0)) return toast("Type a bid amount.");
    doBid(v, +e.target.getAttribute("data-seen"));
  });
  window.addEventListener("storage", function () { render(); });
  render();
  setInterval(render, 250);
})();
