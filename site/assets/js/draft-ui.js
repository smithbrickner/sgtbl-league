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
    extra: $("[data-dr-extra]"), board: $("[data-dr-board]"), log: $("[data-dr-log]"), pool: $("[data-dr-pool]") };
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
  function dot(t) { return '<span class="dr-team-dot dr-t-' + t.toLowerCase() + '" aria-hidden="true"></span>'; }
  function the(t) { return "the " + esc(t); }
  function timer(ends) { return '<span data-dr-timer data-ends="' + ends + '"></span>'; }

  // ---- Private scouting reports (coaches only; user 2026-11-21): 8 skills rated 1-10 plus notes, kept per team.
  //      Only that team sees them; the League Admin doesn't. Prototype: saved in this browser. ----
  var SKILLS = [["sh", "Shooting"], ["fi", "Finishing"], ["bh", "Ball handling"], ["pa", "Passing"], ["re", "Rebounding"], ["de", "Defense"], ["at", "Athleticism"], ["iq", "Basketball IQ"]];
  var SCOUT_KEY = "sgtbl-mock-scouting";
  function scoutAll() { try { return JSON.parse(localStorage.getItem(SCOUT_KEY) || "{}"); } catch (e) { return {}; } }
  function scout(pid) { var a = scoutAll()[ME] || {}, x = a[pid] || {}; return { r: x.r || {}, notes: x.notes || "" }; }
  function saveScout(pid, rep) { var a = scoutAll(); a[ME] = a[ME] || {}; rep.at = Date.now(); a[ME][pid] = rep; try { localStorage.setItem(SCOUT_KEY, JSON.stringify(a)); } catch (e) {} }
  function rated(rep) { return SKILLS.filter(function (k) { return rep.r[k[0]]; }).length; }
  function total(rep) { return SKILLS.reduce(function (m, k) { return m + (rep.r[k[0]] || 0); }, 0); }
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
      return '<div class="' + cls.join(" ") + '"><div class="dr-tile-top"><b>' + esc(t) + (!admin && t === ME ? ' <span>(you)</span>' : "") + '</b>' + (tag ? '<em>' + tag + '</em>' : "") + '</div>' +
        '<div class="dr-tile-money">' + money(D.budgetLeft(st, t)) + '</div><div class="dr-tile-sub">' + D.roster(st, t).length + '/' + D.SPOTS + ' · max ' + money(Math.max(0, D.maxBid(st, t))) + '</div></div>';
    }).join("");
  }

  // ---- Hero: photo, main panel, bid box ----
  function photoHtml(st) {
    var r = st.lot && (st.status === "bidding" || st.status === "review") ? D.player(st.lot.pid) : null;
    return r ? R.avatar(r, "xl") : '<div class="dr-photo-empty" aria-hidden="true"><img src="../assets/img/sgtbl-logo.svg" alt=""></div>';
  }

  function mainHtml(st) {
    var lot = st.lot;
    if (st.status === "setup") {
      if (!admin) return '<div class="dr-eyebrow">Auction draft</div><h2>The draft hasn’t started</h2><p>The League Admin starts the draft from the Draft Suite. Until then, look through the players below and star the ones you want to target. This page updates by itself when it begins.</p>';
      var n = D.pool(st).length, need = st.order.length * D.SPOTS;
      return '<div class="dr-eyebrow">Set up</div><h2>Start the auction draft</h2>' +
        '<div class="dr-setup"><div class="field"><label for="drSecs">Opening countdown for each player</label><select id="drSecs" class="input">' +
        [10, 20, 30, 45, 60, 90].map(function (s) { return '<option value="' + s + '"' + (s === st.secs ? " selected" : "") + '>' + s + ' seconds</option>'; }).join("") + '</select></div>' +
        '<div><div class="dr-label">Nomination order</div><ol class="dr-order-list">' + st.order.map(function (t) { return '<li>' + dot(t) + esc(t) + '</li>'; }).join("") + '</ol><button type="button" class="btn btn-sm dr-btn-ghost" data-dr="shuffle">Shuffle order</button></div></div>' +
        '<p class="dr-small">' + n + ' approved players for ' + need + ' roster spots.' + (n < need ? ' Approve ' + (need - n) + ' more on <a href="registrations.html">Registrations</a> to fill every roster (you can also do it while the draft runs).' : "") + '</p>' +
        '<div class="dr-row"><button type="button" class="btn dr-btn-primary" data-dr="start"' + (n ? "" : " disabled") + '>Start the draft</button><button type="button" class="btn dr-btn-ghost" data-dr="simulate">Simulate the whole draft (demo)</button></div>';
    }
    if (st.status === "nominate") {
      var t = D.turnTeam(st), mine = !admin && t === ME;
      var h = '<div class="dr-eyebrow">Lot ' + (st.sales.length + st.voided.length + 1) + ' · Nomination</div><h2>' + (mine ? "You’re on the clock" : dot(t) + esc(t) + " to nominate") + '</h2>';
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
        '<h2 class="dr-name">' + plink(r, esc(r.first) + ' <b>' + esc(r.last) + '</b>') + '</h2>' +
        '<div class="dr-pos">' + esc((r.pos || []).map(function (p) { return R.POS[p] || p; }).join(" · ")) + '</div>' +
        '<dl class="dr-facts"><div><dt>Height</dt><dd>' + esc(R.fmtHt(r.ht)) + '</dd></div><div><dt>Shoots</dt><dd>' + esc(r.hand) + '</dd></div><div><dt>Level</dt><dd>' + esc(level(r)) + '</dd></div><div><dt>Will miss</dt><dd>' + esc(r.conflicts || "None listed") + '</dd></div></dl>';
    }
    if (st.status === "done") {
      var full = st.order.every(function (x) { return D.spotsLeft(st, x) <= 0; });
      var d = '<div class="dr-eyebrow">All lots sold</div><h2>' + (full ? "Every roster is full" : "The pool is empty") + '</h2>';
      if (!full) d += '<p>' + st.order.filter(function (x) { return D.spotsLeft(st, x) > 0; }).map(function (x) { return esc(x) + " need " + D.spotsLeft(st, x); }).join(", ") + ' more. ' + (admin ? 'Approve more players on <a href="registrations.html">Registrations</a> and the draft picks up again, or finish now.' : "The League Admin can approve more players.") + '</p>';
      d += admin ? '<p>Check the draft board, then lock the rosters. The league switches to the in-season phase and new sign-ups go to free agency.</p><div class="dr-row"><button type="button" class="btn dr-btn-primary" data-dr="finish">Lock rosters and finish the draft</button></div>' : '<p class="dr-muted">Waiting for the League Admin to lock the rosters.</p>';
      return d;
    }
    if (st.status === "final") return '<div class="dr-eyebrow">Draft complete</div><h2>Rosters are locked</h2><p>The league is in season. Players who register from now on go to the free-agent pool' + (admin ? "." : ' (see <a href="player-pool.html">Player Pool</a>).') + '</p>';
    return "";
  }

  function nomForm(st, team) {
    var p = D.pool(st).sort(function (a, b) { return (a.last + a.first).localeCompare(b.last + b.first); });
    return '<div class="dr-row"><label class="sr-only" for="drNom' + (admin ? "A" : "") + '">Player to nominate</label><select id="drNom' + (admin ? "A" : "") + '" class="input"><option value="">Choose a player</option>' +
      p.map(function (r) { return '<option value="' + r.id + '">' + esc(r.last + ", " + r.first + " · " + posText(r)) + '</option>'; }).join("") +
      '</select><button type="button" class="btn dr-btn-primary" data-dr="nominate" data-team="' + esc(team) + '">Nominate' + (admin ? " for " + the(team) : "") + '</button></div>';
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
        '<div class="dr-current"><span>Current bid</span><strong>' + money(lot.high.amt) + '</strong><em>' + dot(lot.high.team) + esc(lot.high.team) + (lot.high.team === ME && !admin ? " (you)" : "") + '</em></div>' +
        '<div class="dr-next">Next bid at least <b>' + money(D.minNext(lot)) + '</b> · raises of $' + D.raise(lot.high.amt) + ' at this price</div>';
      if (admin) return h + '<div class="dr-row"><button type="button" class="btn btn-sm dr-btn-ghost" data-dr="void">Cancel this lot</button></div>';
      if (lot.teams.indexOf(ME) < 0) return h + '<p class="dr-muted dr-small">Your roster is full.</p>';
      if (lot.high.team === ME) return h + '<div class="dr-youhigh">You’re the high bidder</div>';
      var mb = D.maxBid(st, ME), min = D.minNext(lot), off = st.paused || min > mb;
      h += '<div class="dr-quick">' + quickBids(st, lot).map(function (a, i) { return '<button type="button" class="btn ' + (i ? "dr-btn-ghost" : "dr-btn-bid") + '" data-dr="bid" data-amt="' + a + '"' + (off ? " disabled" : "") + '>' + (i ? "" : "Bid ") + money(a) + '</button>'; }).join("") + '</div>' +
        '<form class="dr-row dr-custom" data-dr-bidform><label class="sr-only" for="drBid">Your bid</label><span class="dr-dollar">$</span><input id="drBid" class="input" type="number" inputmode="numeric" min="' + min + '" max="' + mb + '" step="1" placeholder="' + min + '"' + (off ? " disabled" : "") + '><button class="btn dr-btn-ghost" type="submit"' + (off ? " disabled" : "") + '>Bid</button></form>' +
        '<div class="dr-small dr-muted">' + (min > mb ? "This is above your max bid of " + money(mb) + "." : "Your max bid: " + money(mb) + " (you keep $1 for each other open spot).") + '</div>';
      return h;
    }
    if (st.status === "review") {
      var res = st.result;
      return '<div class="dr-clock-label">Bidding closed</div><div class="dr-sold">Sold</div>' +
        '<div class="dr-current"><span>Winning bid</span><strong>' + money(res.price) + '</strong><em>' + dot(res.winner) + esc(res.winner) + (res.winner === ME && !admin ? " (you)" : "") + '</em></div>' +
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
    return '<div class="dr-board-grid" style="grid-template-columns:repeat(' + st.order.length + ',minmax(112px,1fr))">' + st.order.map(function (t) {
      var ro = D.roster(st, t), slots = [];
      for (var i = 0; i < D.SPOTS; i++) {
        var s = ro[i], r = s && D.player(s.pid);
        slots.push(s ? '<li>' + (r ? R.avatar(r, "xs") : "") + '<span class="dr-slot-txt">' + (r ? plink(r) : esc(s.name)) + '<em>' + esc(r ? posText(r) : "") + '</em></span><b>' + money(s.price) + '</b></li>' : '<li class="empty"><span class="dr-slot-txt">Open spot</span></li>');
      }
      return '<div class="dr-col' + (!admin && t === ME ? " me" : "") + '"><div class="dr-col-head dr-tc-' + t.toLowerCase() + '"><b>' + esc(t) + '</b><span>' + money(D.budgetLeft(st, t)) + ' left</span></div><ol>' + slots.join("") + '</ol></div>';
    }).join("") + '</div>';
  }

  // ---- Bid log for the player on the block + recent sales ----
  function logHtml(st) {
    var lot = st.lot, h = "";
    if (lot && (st.status === "bidding" || st.status === "review")) {
      h += '<div class="dr-label">This lot</div><ol class="dr-bidlog">' + lot.bids.slice().reverse().slice(0, 12).map(function (b, i) {
        return '<li' + (i === 0 ? ' class="top"' : "") + '>' + dot(b.team) + '<span class="dr-bl-team">' + esc(b.team) + (b.opening ? ' <em>opened</em>' : "") + '</span><b>' + money(b.amt) + '</b></li>';
      }).join("") + '</ol>';
    }
    var sales = st.sales.slice().reverse().slice(0, 10);
    h += '<div class="dr-label">Recent sales</div>' + (sales.length ? '<ol class="dr-sales">' + sales.map(function (s) {
      var r = D.player(s.pid);
      return '<li>' + (r ? R.avatar(r, "sm") : "") + '<span class="dr-sale-txt"><b>' + (r ? plink(r) : esc(s.name)) + '</b><em>' + dot(s.team) + esc(s.team) + '</em></span><strong>' + money(s.price) + '</strong></li>';
    }).join("") + '</ol>' : '<p class="dr-muted dr-small">No players sold yet.</p>');
    if (st.voided.length) h += '<p class="dr-muted dr-small">Voided: ' + st.voided.map(function (v) { return esc(v.name); }).join(", ") + '</p>';
    return h;
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
      var all = scoutAll()[ME] || {}, tot = function (r) { var x = all[r.id]; return x && x.r ? total({ r: x.r }) : -1; };
      return function (x, y) { return tot(y) - tot(x) || byName(x, y); };   // highest total first; unrated players last
    }
    return byName;
  }
  function scoutCell(r) {
    var rep = scout(r.id), n = rated(rep);
    return '<td class="dr-scout">' + (n ? '<b>' + total(rep) + '</b><span>/80</span>' + (n < 8 ? '<em>' + n + ' of 8</em>' : "") : '<span class="dr-muted">Not rated</span>') +
      (rep.notes ? ' <i title="You have notes on this player" aria-label="Has notes">&#9998;</i>' : "") + '</td>';
  }

  // ---- Player pop-up: details, where the player stands, and (coaches) a private scouting report ----
  document.body.insertAdjacentHTML("beforeend", '<dialog class="dr-pdlg" id="drPlayer" aria-labelledby="drPName"><button type="button" class="dr-pdlg-x" data-dr-close aria-label="Close">&#10005;</button><div data-dr-pbody></div></dialog>');
  var dlg = document.getElementById("drPlayer"), dlgBody = dlg.querySelector("[data-dr-pbody]"), openPid = "", saveT;
  function pstatusHtml(st, r) {
    var sale = st.sales.filter(function (x) { return x.pid === r.id; })[0], lot = st.lot, h = "";
    if (sale) h = '<span class="dr-pill">Drafted</span> ' + dot(sale.team) + esc(sale.team) + ' for <b>' + money(sale.price) + '</b>';
    else if (lot && lot.pid === r.id && st.status === "bidding") h = '<span class="dr-pill live">On the block</span> High bid <b>' + money(lot.high.amt) + '</b> by ' + dot(lot.high.team) + esc(lot.high.team);
    else if (lot && lot.pid === r.id && st.status === "review") h = '<span class="dr-pill live">Sold</span> to ' + dot(st.result.winner) + esc(st.result.winner) + ' for <b>' + money(st.result.price) + '</b>, waiting for League Admin';
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
  function scoutTotalText(rep) { var n = rated(rep); return n ? "Total " + total(rep) + " / 80" + (n < 8 ? " · " + n + " of 8 skills rated" : "") : "Not rated yet"; }
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
      h += '<section class="dr-scouting"><div class="dr-scout-head"><h3>Your scouting report</h3><span data-dr-stotal' + (rated(rep) ? "" : ' class="none"') + '>' + scoutTotalText(rep) + '</span></div>' +
        '<div class="dr-skills">' + SKILLS.map(function (k) {
          var v = rep.r[k[0]] || "";
          return '<label class="dr-skill"><span>' + k[1] + '</span><select class="input" data-skill="' + k[0] + '"><option value="">&ndash;</option>' +
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<option' + (n === v ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select></label>';
        }).join("") + '</div>' +
        '<label class="dr-notes-l" for="drSNotes">Notes</label><textarea id="drSNotes" class="input dr-notes" rows="4" placeholder="Optional: strengths, fit with your roster, availability concerns, the most you\u2019d pay\u2026">' + esc(rep.notes) + '</textarea>' +
        '<p class="dr-muted dr-small">1 = weak, 10 = elite. Only the ' + esc(ME) + ' can see your ratings and notes. They save as you go, and the player list sorts by your total.</p></section>';
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
    var t = dlgBody.querySelector("[data-dr-stotal]"); if (t) { t.textContent = scoutTotalText(rep); t.classList.toggle("none", !rated(rep)); }
    render();
  }
  dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest("[data-dr-close]")) dlg.close(); });
  dlg.addEventListener("close", function () { if (saveT) { clearTimeout(saveT); saveFromDialog(); } openPid = ""; });
  dlg.addEventListener("change", function (e) { if (e.target.matches("[data-skill]")) saveFromDialog(); });
  dlg.addEventListener("input", function (e) { if (e.target.id === "drSNotes") { clearTimeout(saveT); saveT = setTimeout(function () { saveT = null; saveFromDialog(); }, 400); } });

  function statusText(st) {
    if (st.paused && (st.status === "nominate" || st.status === "bidding")) return "Paused";
    return { setup: "Not started", nominate: "Live · nominating", bidding: "Live · bidding", review: admin ? "Live · confirm sale" : "Live · awaiting admin", done: "All lots sold", final: "Complete" }[st.status] || "";
  }

  function render() {
    var st = D.load();
    if (D.step(st, Date.now())) D.save(st);
    var now = st.paused || Date.now();                               // clocks freeze while paused
    set(el.teams, teamsHtml(st)); set(el.photo, photoHtml(st)); set(el.main, mainHtml(st)); set(el.bid, bidHtml(st));
    set(el.extra, extraHtml(st)); set(el.board, boardHtml(st)); set(el.log, logHtml(st)); set(el.pool, poolHtml(st));
    if (dlg.open && openPid) { var pr = D.player(openPid); if (pr) set(dlgBody.querySelector("[data-dr-pstatus]"), pstatusHtml(st, pr)); }
    var hero = $(".dr-hero"); if (hero) { hero.classList.toggle("is-review", st.status === "review"); hero.classList.toggle("is-paused", !!st.paused); }
    if (statusEl) { statusEl.textContent = statusText(st); statusEl.className = "badge " + (st.paused ? "badge-warning" : st.status === "final" ? "badge-success" : st.status === "setup" ? "badge-info" : st.status === "done" ? "badge-warning" : "badge-live"); }
    document.querySelectorAll("[data-dr-timer]").forEach(function (t) {
      var left = +t.getAttribute("data-ends") - now; t.textContent = mmss(left);
      var c = t.closest(".dr-clock"); if (c) c.classList.toggle("low", left <= 5000);
    });
  }

  function doBid(amt) {
    var err = D.bid(ME, amt);
    if (!err) { var i = document.getElementById("drBid"); if (i) i.value = ""; }
    done(err, err ? "" : "You bid $" + amt + ".");
  }

  document.addEventListener("click", function (e) {
    var pl = e.target.closest("[data-dr-player]"); if (pl) return openPlayer(pl.getAttribute("data-dr-player"));
    var b = e.target.closest("[data-dr]");
    if (b) {
      var k = b.getAttribute("data-dr");
      if (k === "shuffle") return done(D.shuffle());
      if (k === "start") return done(D.start(), "Draft started. " + D.load().order[0] + " nominate first.");
      if (k === "simulate") { if (!confirm("Play out the whole draft instantly with simulated bidding for every team (the Knicks included)? Use “Reset draft” to undo.")) return; return done(D.simulate(), "Draft simulated. Check the draft board, then lock the rosters."); }
      if (k === "nominate") {
        var sel = b.parentNode.querySelector("select"), pid = b.getAttribute("data-pid") || (sel && sel.value), team = b.getAttribute("data-team");
        if (!pid) return toast("Choose a player to nominate.");
        var r = D.player(pid), err = D.nominate(pid, team); if (!err && dlg.open) dlg.close();
        return done(err, (r ? r.first + " " + r.last : "Player") + " is on the block.");
      }
      if (k === "bid") return doBid(+b.getAttribute("data-amt"));
      if (k === "pause") return done(D.pause(), "Clock paused for everyone.");
      if (k === "resume") return done(D.resume(), "Clock resumed.");
      if (k === "addtime") { var sec = parseInt((document.getElementById("drAdd") || {}).value, 10); return done(D.addTime(sec), "Added " + sec + " seconds."); }
      if (k === "confirm") { var st = D.load(), res = st.result; return done(D.confirm(), res ? "Sale confirmed: " + res.winner + ", $" + res.price + "." : ""); }
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
    doBid(v);
  });
  window.addEventListener("storage", function () { render(); });
  render();
  setInterval(render, 250);
})();
