/* SGTBL auction draft: PROTOTYPE page UI shared by admin/draft.html (role "admin") and captain/draft-room.html
   (role "coach", the Knicks). Uses window.SGTBLDraft (draft.js) and window.SGTBLReg (registrations.js). */
(function () {
  var D = window.SGTBLDraft, R = window.SGTBLReg, esc = R.esc;
  var role = document.body.getAttribute("data-draft-role") || "coach", ME = D.ME, admin = role === "admin";
  var $ = function (s) { return document.querySelector(s); };
  var stage = $("[data-dr-stage]"), teamsEl = $("[data-dr-teams]"), feedEl = $("[data-dr-feed]"), rostersEl = $("[data-dr-rosters]"),
    poolEl = $("[data-dr-pool]"), kpiEl = $("[data-dr-kpis]"), statusEl = $("[data-dr-status]"), toastEl = $("[data-rg-toast]");
  var posF = "all", starredOnly = false, q = "", lastSig = "";

  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, 4200); }
  function board() { try { return JSON.parse(localStorage.getItem("sgtbl-mock-board") || "[]"); } catch (e) { return []; } }
  function setBoard(b) { try { localStorage.setItem("sgtbl-mock-board", JSON.stringify(b)); } catch (e) {} }
  function done(err, ok) { if (err) toast(err); else if (ok) toast(ok); render(true); }
  function mmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
  function level(r) { return { "College (varsity) or higher": "College varsity+", "College (club or intramural)": "College club", "High school": "High school", "Pickup / recreational": "Pickup / rec" }[r.level] || r.level || ""; }
  function posText(r) { return (r.pos || []).join(" / "); }
  function teamTag(t) { return '<span class="dr-team-dot dr-t-' + t.toLowerCase() + '" aria-hidden="true"></span>' + esc(t); }

  function playerBlock(r) {
    if (!r) return '<p class="muted">Player not found.</p>';
    return '<div class="dr-player"><div><h2>' + esc(r.first + " " + r.last) + '</h2><div class="pp-pos">' + esc((r.pos || []).map(function (p) { return R.POS[p] || p; }).join(" · ")) + '</div></div>' +
      '<dl class="pp-facts"><div><dt>Height</dt><dd>' + esc(R.fmtHt(r.ht)) + '</dd></div><div><dt>Shoots</dt><dd>' + esc(r.hand) + '</dd></div><div><dt>Level</dt><dd>' + esc(level(r)) + '</dd></div></dl>' +
      '<p class="pp-miss"><span class="muted">Dates they’ll miss:</span> ' + esc(r.conflicts || "None listed") + '</p></div>';
  }

  // Revealed bids after a lot closes: one column per round.
  function bidsTable(st, rounds, winner, price) {
    var teams = Object.keys(rounds[0] ? rounds[0].bids : {});
    st.order.forEach(function (t) { if (teams.indexOf(t) < 0) teams.push(t); });
    var last = function (t) { for (var i = rounds.length - 1; i >= 0; i--) if (rounds[i].bids[t] != null) return rounds[i].bids[t]; return -1; };
    teams.sort(function (a, b) { return last(b) - last(a); });
    var head = '<tr><th>Team</th>' + rounds.map(function (r) { return '<th class="num">' + (r.round === 1 ? "Bid" : "Tie-break " + (r.round - 1)) + '</th>'; }).join("") + '</tr>';
    var body = teams.map(function (t) {
      var win = t === winner;
      return '<tr' + (win ? ' class="dr-win"' : "") + '><td>' + teamTag(t) + (win ? ' <span class="badge badge-success">Wins at ' + money(price) + '</span>' : "") + '</td>' +
        rounds.map(function (r) { return '<td class="num">' + (r.bids[t] != null ? money(r.bids[t]) : (r.round === 1 ? '<span class="muted">No bid</span>' : '<span class="muted">—</span>')) + '</td>'; }).join("") + '</tr>';
    }).join("");
    return '<div class="table-wrap"><table class="table dr-bids"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function stageHtml(st, now) {
    var lot = st.lot, h = "";
    if (st.status === "setup") {
      if (!admin) return '<div class="dr-stage-head"><span class="eyebrow">Auction draft</span><h2>The draft hasn’t started</h2></div><p>The League Admin starts the draft from the Draft Suite. Until then, look through the pool below and star the players you want to target. When it starts, this page updates by itself.</p>' +
        '<p class="muted dr-small">Each team has ' + money(D.BUDGET) + ' to fill ' + D.SPOTS + ' roster spots. Coaches take turns nominating; bids are sealed until the countdown ends.</p>';
      var n = D.pool(st).length, need = st.order.length * D.SPOTS;
      return '<div class="dr-stage-head"><span class="eyebrow">Set up</span><h2>Start the auction draft</h2></div>' +
        '<div class="dr-setup"><div class="field"><label for="drSecs">Countdown for each player</label><select id="drSecs" class="input">' +
        [10, 20, 30, 45, 60, 90].map(function (s) { return '<option value="' + s + '"' + (s === st.secs ? " selected" : "") + '>' + s + ' seconds</option>'; }).join("") + '</select></div>' +
        '<div><div class="dr-label">Nomination order</div><ol class="dr-order-list">' + st.order.map(function (t) { return '<li>' + teamTag(t) + '</li>'; }).join("") + '</ol><button type="button" class="btn btn-sm btn-ghost rg-btn-line" data-dr="shuffle">Shuffle order</button></div></div>' +
        '<p class="dr-small">' + n + ' approved players in the pool for ' + need + ' roster spots.' + (n < need ? ' <strong>Approve ' + (need - n) + ' more on the <a href="registrations.html">Registrations</a> page to fill every roster</strong> (you can also approve them while the draft runs).' : "") + '</p>' +
        '<div class="rg-act-row"><button type="button" class="btn btn-primary" data-dr="start"' + (n ? "" : " disabled") + '>Start the draft</button><button type="button" class="btn btn-ghost rg-btn-line" data-dr="simulate">Simulate the whole draft (demo)</button></div>';
    }
    if (st.status === "nominate") {
      var t = D.turnTeam(st), mine = !admin && t === ME, bot = D.isBot(t);
      h = '<div class="dr-stage-head"><span class="eyebrow">Lot ' + (st.sales.length + st.voided.length + 1) + ' · Nomination</span><h2>' + (mine ? "Your turn to nominate" : "The " + esc(t) + " are nominating") + '</h2></div>';
      if (mine) h += '<p>Pick a player to put up for auction. You open the bidding at $1, then every team gets ' + st.secs + ' seconds to place a sealed bid. Use the <strong>Nominate</strong> buttons in the pool below, or choose here:</p>' + nomForm(st, t);
      else if (bot) h += '<p class="muted">Simulated coach. They nominate in <b data-dr-timer data-ends="' + (st.turnAt + 4000) + '">0:04</b>.</p>';
      else h += '<p class="muted">Waiting for the ' + esc(t) + ' coach to choose a player.</p>';
      if (admin) h += '<div class="rg-actions"><div class="dr-label">Nominate on the ' + esc(t) + '’ behalf (for example, if their coach is stuck)</div>' + nomForm(st, t) + '</div>';
      return h;
    }
    if (st.status === "bidding") {
      var r = D.player(lot.pid), tb = lot.round > 1, left = lot.endsAt - now, started = now >= lot.startAt;
      h = '<div class="dr-stage-head"><span class="eyebrow">Lot ' + lot.n + ' · Nominated by the ' + esc(lot.nominator) + '</span>' +
        (tb ? '<span class="badge badge-warning">Tie-break round ' + (lot.round - 1) + ': ' + lot.teams.map(esc).join(" vs ") + '</span>' : '<span class="badge badge-live">Bidding open</span>') + '</div>' +
        '<div class="dr-live">' + playerBlock(r) + '<div class="dr-clock' + (left <= 5000 ? " low" : "") + '"><div class="dr-label">' + (started ? "Time left" : "Next round starts in") + '</div><div class="dr-time" data-dr-timer data-ends="' + (started ? lot.endsAt : lot.startAt) + '">' + mmss(started ? left : lot.startAt - now) + '</div></div></div>';
      if (tb) h += '<p class="dr-small">The top bids tied at <strong>' + money(lot.min) + '</strong>. Only the tied teams bid again: new bids must be at least ' + money(lot.min) + ', and a team that doesn’t re-bid stays at ' + money(lot.min) + '.</p>';
      h += '<div class="dr-label">Sealed bids (amounts are hidden until time runs out)</div><ul class="dr-status">' + st.order.map(function (t) {
        var inR = lot.teams.indexOf(t) >= 0, b = lot.bids[t], vis = b && b.at <= now, cls = !inR ? "out" : vis ? "in" : "wait";
        var txt = !inR ? (D.spotsLeft(st, t) <= 0 ? "Roster full" : "Not in this round") : vis ? (b.opening ? "Opening bid in" : "Bid in") : tb ? "Standing at " + money(lot.min) : "No bid yet";
        if (!admin && t === ME && vis) txt = "Your bid: " + money(b.amt);
        return '<li class="dr-st-' + cls + (t === ME && !admin ? " me" : "") + '"><span>' + teamTag(t) + '</span><span>' + txt + '</span></li>';
      }).join("") + '</ul>';
      if (!admin) {
        if (lot.teams.indexOf(ME) < 0) h += '<p class="muted dr-small">' + (D.spotsLeft(st, ME) <= 0 ? "Your roster is full, so you sit out the rest of the draft." : "You’re not part of this tie-break round.") + '</p>';
        else {
          var mb = D.maxBid(st, ME), my = lot.bids[ME];
          h += '<form class="dr-bid" data-dr-bidform><label for="drBid">Your sealed bid</label><div class="rg-act-row"><span class="dr-dollar">$</span><input id="drBid" class="input" type="number" inputmode="numeric" min="' + lot.min + '" max="' + mb + '" step="1" placeholder="' + lot.min + '" required>' +
            '<button class="btn btn-primary" type="submit"' + (started ? "" : " disabled") + '>' + (my ? "Change my bid" : "Place sealed bid") + '</button></div>' +
            '<div class="rg-act-note">Max bid ' + money(mb) + ' (you keep $1 for each other open spot). ' + (my ? "Your current bid is <strong>" + money(my.amt) + "</strong>; you can change it until time runs out." : "You can change your bid until time runs out.") + '</div></form>';
        }
      } else h += '<div class="rg-act-row"><button type="button" class="btn btn-sm btn-ghost rg-btn-line" data-dr="void">Cancel this lot (player back to the pool)</button></div>';
      return h;
    }
    if (st.status === "review") {
      var rr = D.player(lot.pid), res = st.result;
      h = '<div class="dr-stage-head"><span class="eyebrow">Lot ' + lot.n + ' · Bidding closed</span><span class="badge badge-warning">' + (admin ? "Needs your confirmation" : "Waiting for League Admin") + '</span></div>' +
        '<h2 class="dr-result">' + esc(rr ? rr.first + " " + rr.last : lot.pid) + (res.winner ? ' → ' + esc(res.winner) + ' for ' + money(res.price) : ': tied at ' + money(res.price)) + '</h2>' +
        '<p class="dr-small muted">All bids are now visible to every team.</p>' + bidsTable(st, lot.rounds, res.winner, res.price);
      if (!res.winner) {
        h += '<p class="dr-small"><strong>' + res.tied.map(esc).join(" and ") + ' are tied at ' + money(res.price) + ', and none of them has room in their budget to bid higher,</strong> so another round can’t settle it. ' + (admin ? "Choose the winner (for example, by coin flip):" : "The League Admin will choose the winner.") + '</p>';
        if (admin) h += '<div class="rg-act-row">' + res.tied.map(function (t) { return '<button type="button" class="btn btn-ghost rg-btn-line" data-dr="award" data-team="' + esc(t) + '">Award to the ' + esc(t) + '</button>'; }).join("") + '<button type="button" class="btn btn-ghost rg-btn-line" data-dr="flip">Flip a coin</button><button type="button" class="btn btn-ghost rg-btn-line" data-dr="void">Void</button></div>';
        return h;
      }
      if (res.awarded) h += '<p class="dr-small muted">Tie settled by the League Admin.</p>';
      if (admin) h += '<div class="rg-act-row dr-review-act"><button type="button" class="btn btn-primary" data-dr="confirm">Confirm sale to the ' + esc(res.winner) + '</button><button type="button" class="btn btn-ghost rg-btn-line" data-dr="void">Void (player back to the pool)</button></div>' +
        '<div class="rg-act-note">Confirming adds the player to the ' + esc(res.winner) + '’ roster, takes ' + money(res.price) + ' from their draft budget and passes the nomination to the next team. Voiding lets the ' + esc(lot.nominator) + ' nominate again.</div>';
      else h += '<p class="muted dr-small">The League Admin checks each result before the player joins a roster.</p>';
      return h;
    }
    if (st.status === "done") {
      var full = st.order.every(function (t) { return D.spotsLeft(st, t) <= 0; });
      h = '<div class="dr-stage-head"><span class="eyebrow">All lots sold</span></div><h2>' + (full ? "Every roster is full" : "The pool is empty") + '</h2>';
      if (!full) h += '<p>' + st.order.filter(function (t) { return D.spotsLeft(st, t) > 0; }).map(function (t) { return esc(t) + " need " + D.spotsLeft(st, t); }).join(", ") + ' more. ' + (admin ? 'Approve more players on the <a href="registrations.html">Registrations</a> page and the draft picks up again, or finish now.' : "The League Admin can approve more players.") + '</p>';
      if (admin) h += '<p>Check the rosters below, then lock them. That ends the draft and switches the league to the in-season phase, so new sign-ups go to the free-agent pool.</p><div class="rg-act-row"><button type="button" class="btn btn-primary" data-dr="finish">Lock rosters and finish the draft</button></div>';
      else h += '<p class="muted">Waiting for the League Admin to lock the rosters.</p>';
      return h;
    }
    if (st.status === "final") return '<div class="dr-stage-head"><span class="eyebrow">Draft complete</span><span class="badge badge-success">Rosters locked</span></div><h2>The draft is over</h2><p>Rosters are set and the league is in season. Players who register from now on go to the free-agent pool' + (admin ? "." : ' (see <a href="player-pool.html">Player Pool</a>).') + '</p>';
    return "";
  }

  function nomForm(st, team) {
    var p = D.pool(st).sort(function (a, b) { return (a.last + a.first).localeCompare(b.last + b.first); });
    return '<div class="rg-act-row"><label class="sr-only" for="drNom">Player to nominate</label><select id="drNom" class="input"><option value="">Choose a player</option>' +
      p.map(function (r) { return '<option value="' + r.id + '">' + esc(r.last + ", " + r.first + " · " + posText(r)) + '</option>'; }).join("") +
      '</select><button type="button" class="btn btn-primary" data-dr="nominate" data-team="' + esc(team) + '">Nominate' + (admin ? " for the " + esc(team) : "") + '</button></div>';
  }

  function teamsHtml(st) {
    return '<h3>Teams</h3><p class="muted dr-small">Draft budget left · roster · max bid</p><ol class="dr-teams-list">' + st.order.map(function (t, i) {
      var cur = (st.status === "nominate" && i === st.turn) || (st.lot && st.lot.nominator === t && (st.status === "bidding" || st.status === "review"));
      return '<li class="' + (cur ? "current " : "") + (t === ME && !admin ? "me" : "") + '"><span class="num">' + (i + 1) + '</span><div><b>' + esc(t) + (t === ME && !admin ? ' <span class="muted">(you)</span>' : "") + '</b>' +
        '<span>' + D.roster(st, t).length + '/' + D.SPOTS + ' · max ' + money(Math.max(0, D.maxBid(st, t))) + '</span></div><strong class="tnum">' + money(D.budgetLeft(st, t)) + '</strong></li>';
    }).join("") + '</ol>' + (st.status !== "bidding" && st.status !== "review" ? "" : '<p class="muted dr-small">Highlighted: the team that nominated the player on the block.</p>');
  }

  function feedHtml(st) {
    var items = st.sales.slice().reverse();
    return '<h3>Results</h3>' + (items.length ? '<ol class="dr-feed">' + items.map(function (s) {
      var bids = s.rounds[s.rounds.length - 1] ? s.rounds[0].bids : {};
      var list = Object.keys(bids).sort(function (a, b) { return bids[b] - bids[a]; }).map(function (t) { return esc(t) + " " + money(bids[t]); }).join(" · ");
      return '<li><span class="num">' + s.n + '</span><div><b>' + esc(s.name) + '</b><span>' + esc(s.team) + ' · ' + money(s.price) + (s.rounds.length > 1 ? " after a tie-break" : "") + '</span><span class="muted">Bids: ' + list + '</span></div></li>';
    }).join("") + '</ol>' : '<p class="muted dr-small">Confirmed sales appear here, with every team’s bid.</p>') +
      (st.voided.length ? '<p class="muted dr-small">Voided lots: ' + st.voided.map(function (v) { return esc(v.name); }).join(", ") + '</p>' : "");
  }

  function rostersHtml(st) {
    return st.order.map(function (t) {
      var ro = D.roster(st, t);
      return '<div class="dr-roster' + (t === ME && !admin ? " me" : "") + '"><div class="dr-roster-head">' + teamTag(t) + '<span class="muted">' + ro.length + '/' + D.SPOTS + ' · spent ' + money(D.spent(st, t)) + '</span></div>' +
        (ro.length ? '<ul>' + ro.map(function (s) { var r = D.player(s.pid); return '<li><span>' + esc(s.name) + ' <span class="muted">' + esc(r ? posText(r) : "") + '</span></span><b class="tnum">' + money(s.price) + '</b></li>'; }).join("") + '</ul>' : '<p class="muted dr-small">No players yet.</p>') + '</div>';
    }).join("");
  }

  function poolHtml(st) {
    var list = D.pool(st), b = board(), canNom = st.status === "nominate" && (admin || D.turnTeam(st) === ME), nomTeam = D.turnTeam(st);
    var P = [["all", "All"], ["PG", "PG"], ["SG", "SG"], ["SF", "SF"], ["PF", "PF"], ["C", "C"]];
    var chips = P.map(function (p) {
      var n = p[0] === "all" ? list.length : list.filter(function (r) { return r.pos.indexOf(p[0]) >= 0; }).length;
      return '<button type="button" role="tab" class="rg-chip" aria-selected="' + (posF === p[0]) + '" data-dr-pos="' + p[0] + '">' + p[1] + ' <b>' + n + '</b></button>';
    }).join("") + (admin ? "" : '<button type="button" class="rg-chip" aria-pressed="' + starredOnly + '" aria-selected="' + starredOnly + '" data-dr-starred>★ Starred <b>' + list.filter(function (r) { return b.indexOf(r.id) >= 0; }).length + '</b></button>');
    var shown = list.filter(function (r) { return posF === "all" || r.pos.indexOf(posF) >= 0; })
      .filter(function (r) { return !starredOnly || b.indexOf(r.id) >= 0; })
      .filter(function (r) { return !q || (r.first + " " + r.last).toLowerCase().indexOf(q) >= 0; })
      .sort(function (x, y) { return (x.last + x.first).localeCompare(y.last + y.first); });
    var rows = shown.map(function (r) {
      var star = b.indexOf(r.id) >= 0;
      return '<tr><td><b>' + esc(r.first + " " + r.last) + '</b></td><td>' + esc(posText(r)) + '</td><td>' + esc(R.fmtHt(r.ht)) + '</td><td>' + esc(r.hand) + '</td><td>' + esc(level(r)) + '</td><td class="dr-miss">' + esc(r.conflicts || "—") + '</td><td class="rg-row-act">' +
        (admin ? "" : '<button type="button" class="btn btn-sm btn-ghost dr-star" aria-pressed="' + star + '" aria-label="' + (star ? "Remove from" : "Add to") + ' draft board" data-dr-star="' + r.id + '">' + (star ? "★" : "☆") + '</button>') +
        (canNom ? '<button type="button" class="btn btn-sm btn-primary" data-dr="nominate" data-pid="' + r.id + '" data-team="' + esc(nomTeam) + '">Nominate</button>' : "") + '</td></tr>';
    }).join("");
    return '<div class="rg-tools"><div class="rg-chips" role="tablist" aria-label="Filter by position">' + chips + '</div><div class="field rg-search"><label for="drQ" class="sr-only">Search the pool</label><input id="drQ" class="input" type="search" placeholder="Search players" value="' + esc(q) + '"></div></div>' +
      '<div class="table-wrap"><table class="table rg-table dr-pool"><thead><tr><th>Player</th><th>Pos</th><th>Ht</th><th>Shoots</th><th>Level</th><th>Dates they’ll miss</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="rg-empty muted">No available players match.</td></tr>') + '</tbody></table></div>';
  }

  function kpisHtml(st) {
    var bl = D.budgetLeft(st, ME), mb = D.maxBid(st, ME), ro = D.roster(st, ME).length;
    return '<div class="kpi-card"><div class="label">Draft budget left</div><div class="value">' + money(bl) + '</div><div class="delta muted">of ' + money(D.BUDGET) + ' · disappears after the draft</div></div>' +
      '<div class="kpi-card"><div class="label">Max bid right now</div><div class="value">' + money(Math.max(0, mb)) + '</div><div class="delta muted">keeps $1 for each other open spot</div></div>' +
      '<div class="kpi-card"><div class="label">Roster</div><div class="value">' + ro + '/' + D.SPOTS + '</div><div class="delta muted">' + (D.SPOTS - ro) + ' spots to fill</div></div>' +
      '<div class="kpi-card"><div class="label">Players in the pool</div><div class="value">' + D.pool(st).length + '</div><div class="delta muted">approved, not yet drafted</div></div>';
  }

  function statusText(st) {
    return { setup: "Not started", nominate: "Live · nominating", bidding: "Live · bidding", review: admin ? "Live · confirm sale" : "Live · awaiting admin", done: "All lots sold", final: "Complete" }[st.status] || "";
  }

  function render(force) {
    var now = Date.now(), st = D.load();
    if (D.step(st, now)) D.save(st);
    var vis = st.lot ? Object.keys(st.lot.bids).filter(function (t) { return st.lot.bids[t].at <= now; }).join(",") + (now >= st.lot.startAt) : "";
    var sig = JSON.stringify(st) + "|" + vis + "|" + localStorage.getItem("sgtbl-mock-board") + "|" + localStorage.getItem("sgtbl-mock-registrations-v2") + "|" + posF + starredOnly + q;
    if (force || sig !== lastSig) {
      lastSig = sig;
      var ae = document.activeElement, focusId = ae && ae.id, keep = {};
      ["drBid", "drNom", "drQ"].forEach(function (id) { var el = document.getElementById(id); if (el) keep[id] = el.value; });
      var selStart = ae && ae.id === "drQ" ? ae.selectionStart : null;
      stage.innerHTML = stageHtml(st, now);
      if (teamsEl) teamsEl.innerHTML = teamsHtml(st);
      if (feedEl) feedEl.innerHTML = feedHtml(st);
      if (rostersEl) rostersEl.innerHTML = rostersHtml(st);
      if (poolEl) poolEl.innerHTML = poolHtml(st);
      if (kpiEl) kpiEl.innerHTML = kpisHtml(st);
      if (statusEl) { statusEl.textContent = statusText(st); statusEl.className = "badge " + (st.status === "final" ? "badge-success" : st.status === "setup" ? "badge-info" : st.status === "done" ? "badge-warning" : "badge-live"); }
      Object.keys(keep).forEach(function (id) { var el = document.getElementById(id); if (el && id !== "drQ") el.value = keep[id]; });
      if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); if (selStart != null && f.setSelectionRange) try { f.setSelectionRange(selStart, selStart); } catch (e) {} } }
    }
    document.querySelectorAll("[data-dr-timer]").forEach(function (el) {
      var left = +el.getAttribute("data-ends") - now; el.textContent = mmss(left);
      var c = el.closest(".dr-clock"); if (c) c.classList.toggle("low", left <= 5000);
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dr]");
    if (b) {
      var k = b.getAttribute("data-dr");
      if (k === "shuffle") return done(D.shuffle());
      if (k === "start") return done(D.start(), "Draft started. The " + D.load().order[0] + " nominate first.");
      if (k === "simulate") { if (!confirm("Play out the whole draft instantly with simulated bids for every team (the Knicks included)? Use “Reset draft” to undo.")) return; return done(D.simulate(), "Draft simulated. Check the rosters, then lock them."); }
      if (k === "nominate") {
        var pid = b.getAttribute("data-pid") || (document.getElementById("drNom") || {}).value, team = b.getAttribute("data-team");
        if (!pid) return toast("Choose a player to nominate.");
        var r = D.player(pid); return done(D.nominate(pid, team), (r ? r.first + " " + r.last : "Player") + " is on the block. Bidding is open.");
      }
      if (k === "award") return done(D.award(b.getAttribute("data-team")), "Awarded to the " + b.getAttribute("data-team") + ". Confirm the sale to finish.");
      if (k === "flip") { var tied = D.load().result.tied, w = tied[Math.floor(Math.random() * tied.length)]; return done(D.award(w), "Coin flip: the " + w + " win. Confirm the sale to finish."); }
      if (k === "confirm") { var st = D.load(), res = st.result; return done(D.confirm(), res ? "Sale confirmed: " + res.winner + " for $" + res.price + "." : ""); }
      if (k === "void") { if (!confirm("Void this lot? The player goes back to the pool and the same team nominates again.")) return; return done(D.voidLot(), "Lot voided. The player is back in the pool."); }
      if (k === "finish") { if (!confirm("Lock every roster and finish the draft? The league switches to the in-season phase.")) return; return done(D.finish(), "Draft complete. Rosters are locked."); }
      if (k === "reset") { if (!confirm("Reset the draft? Every drafted player goes back to the pool.")) return; D.reset(); return done("", "Draft reset."); }
    }
    var p = e.target.closest("[data-dr-pos]"); if (p) { posF = p.getAttribute("data-dr-pos"); return render(true); }
    if (e.target.closest("[data-dr-starred]")) { starredOnly = !starredOnly; return render(true); }
    var s = e.target.closest("[data-dr-star]");
    if (s) { var id = s.getAttribute("data-dr-star"), bd = board(), i = bd.indexOf(id); if (i >= 0) bd.splice(i, 1); else bd.push(id); setBoard(bd); render(true); }
  });
  document.addEventListener("change", function (e) { if (e.target.id === "drSecs") done(D.setSecs(+e.target.value)); });
  document.addEventListener("input", function (e) { if (e.target.id === "drQ") { q = e.target.value.trim().toLowerCase(); render(true); } });
  document.addEventListener("submit", function (e) {
    if (!e.target.matches("[data-dr-bidform]")) return;
    e.preventDefault();
    var amt = parseInt(document.getElementById("drBid").value, 10), err = D.bid(ME, amt);
    if (!err) document.getElementById("drBid").value = "";
    done(err, err ? "" : "Sealed bid of $" + amt + " placed. Nobody else can see the amount until time runs out.");
  });
  window.addEventListener("storage", function () { render(); });
  render(true);
  setInterval(render, 250);
})();
