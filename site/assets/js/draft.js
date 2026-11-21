/* SGTBL auction draft: PROTOTYPE engine shared by the League Admin Draft Suite (admin/draft.html) and the
   Team Portal Draft Room (captain/draft-room.html). State lives in this browser's localStorage, so open both pages
   (two tabs) and they stay in sync. The player pool comes from registrations.js (approved + fee settled).

   Rules modelled (user, 2026-11-21):
   - Every team has a one-time $1,000 draft budget and 9 roster spots.
   - Coaches take turns nominating, in a set order (teams with full rosters are skipped). The nominator opens at $1.
     A coach has 30 seconds to nominate; if time runs out, the system nominates for them (their top starred player if
     they have one, otherwise a random available player).
   - OPEN, INCREMENTAL bidding (replaced sealed bids the same day): everyone sees the current high bid and who holds it.
     A new bid must beat the high bid by the minimum raise: $1 under $50, $5 from $50 up to $200, $10 from $200 up.
   - Each new high bid tops the clock back up to 10 seconds if it had less. When the clock runs out, the high bidder wins.
   - Max bid = budget left - $1 for each other roster spot still to fill. You can't outbid yourself.
   - The commissioner can pause/resume the clock and add time by hand.
   - The League Admin confirms each sale (or voids it, which returns the player to the pool).
   The 5 teams other than the coach persona's Knicks are SIMULATED: each has a hidden price limit per player (seeded
   random), and they raise after a short seeded delay, so every open tab computes exactly the same auction. */
(function () {
  var R = window.SGTBLReg, KEY = "sgtbl-mock-draft-v2";
  var BUDGET = 1000, SPOTS = 9, ME = "Knicks", NOM_DELAY = 4000, NOM_LIMIT = 30000, TOPUP = 10000;

  function blank() {
    return { status: "setup", secs: 30, order: R.TEAMS.slice(), turn: 0, turnAt: 0, lot: null, result: null, sales: [], voided: [], seed: 1 };
  }
  function load() { try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {} return blank(); }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  // Seeded random numbers (same seed -> same numbers in every tab).
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    var a = hash(seed);
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function roster(st, team) { return st.sales.filter(function (s) { return s.team === team; }); }
  function spent(st, team) { return roster(st, team).reduce(function (m, s) { return m + s.price; }, 0); }
  function budgetLeft(st, team) { return BUDGET - spent(st, team); }
  function spotsLeft(st, team) { return SPOTS - roster(st, team).length; }
  function maxBid(st, team) { var s = spotsLeft(st, team); return s <= 0 ? 0 : budgetLeft(st, team) - (s - 1); }
  // Minimum raise over the current high bid (tiered).
  function raise(amt) { return amt < 50 ? 1 : amt < 200 ? 5 : 10; }
  function minNext(lot) { return lot.high.amt + raise(lot.high.amt); }

  function feeOk(r) { return r.payment === "paid" || r.payment === "assistance-granted"; }
  // Players still available to nominate (approved, fee settled, not sold, not on the block right now).
  function pool(st) {
    var gone = {}; st.sales.forEach(function (s) { gone[s.pid] = 1; }); if (st.lot) gone[st.lot.pid] = 1;
    return R.load().filter(function (r) { return r.status === "approved" && feeOk(r) && !gone[r.id]; });
  }
  function player(pid) { return R.load().filter(function (r) { return r.id === pid; })[0] || null; }
  function turnTeam(st) { return st.order[st.turn]; }
  function isBot(team) { return team !== ME; }

  // How much the simulated coaches think a player is worth (never shown anywhere).
  function value(r, seed) {
    var base = { "College (varsity) or higher": 230, "College (club or intramural)": 150, "High school": 95, "Pickup / recreational": 50 }[r.level] || 80;
    var p = String(r.ht || "6-0").split("-"), inches = (+p[0] || 6) * 12 + (+p[1] || 0);
    return Math.max(5, base * (0.7 + 0.6 * rng(seed + "v" + r.id)()) + (inches - 72) * 4);
  }

  // Each simulated coach's hidden price limit for the player on the block.
  function limits(st, lot, includeMe) {
    var out = {}, r = player(lot.pid); if (!r) return out;
    lot.teams.forEach(function (t) {
      if (!isBot(t) && !includeMe) return;
      var g = rng(st.seed + "|lim|" + lot.n + "|" + t), perSpot = budgetLeft(st, t) / Math.max(1, spotsLeft(st, t));
      var v = g() > 0.75 ? 0 : Math.round(value(r, st.seed) * (0.6 + 0.75 * g()));
      out[t] = Math.max(t === lot.nominator ? 1 : 0, Math.min(v, Math.round(perSpot * 2.6)));
    });
    return out;
  }
  // The next raise a simulated coach would make, and when (deterministic from the bid history).
  function nextBotBid(st, lot) {
    var best = null, k = lot.bids.length;
    Object.keys(lot.lim || {}).forEach(function (t) {
      if (t === lot.high.team || lot.teams.indexOf(t) < 0) return;
      var need = minNext(lot), cap = Math.min(lot.lim[t], maxBid(st, t));
      if (need > cap) return;
      var g = rng(st.seed + "|bid|" + lot.n + "|" + k + "|" + t), at = lot.high.at + 1200 + Math.round(g() * 3800), amt = need;
      var gap = cap - need, j = g();
      if (gap > 10 && j < 0.6) amt = need + Math.round(gap * (0.15 + 0.35 * g()));          // far below their limit: a big jump
      else if (j < 0.85) amt = need + raise(need) * Math.floor(g() * 3);                    // a small jump
      amt = Math.min(cap, amt);
      if (amt >= 50) amt = Math.max(need, Math.min(cap, Math.round(amt / 5) * 5));           // round numbers, like people bid
      if (!best || at < best.at) best = { team: t, amt: amt, at: at };
    });
    return best;
  }
  function placeBid(lot, team, amt, at) {
    lot.high = { team: team, amt: amt, at: at };
    lot.bids.push({ team: team, amt: amt, at: at });
    lot.endsAt = Math.max(lot.endsAt, at + TOPUP);
  }

  function openLot(st, pid, nominator, at, includeMe) {
    var teams = st.order.filter(function (t) { return spotsLeft(st, t) > 0; });
    var lot = { n: st.sales.length + st.voided.length + 1, pid: pid, nominator: nominator, teams: teams,
      startAt: at, endsAt: at + st.secs * 1000, high: null, bids: [] };
    placeBid(lot, nominator, 1, at);
    lot.bids[0].opening = true;
    lot.lim = limits(st, lot, includeMe);
    st.lot = lot; st.result = null; st.status = "bidding";
  }

  // Moves the draft forward in time. Deterministic: every tab gets the same answer from the same state.
  function step(st, now) {
    var changed = false, guard = 0;
    if (st.paused) return false;                                   // the commissioner has stopped the clock
    while (guard++ < 2000) {
      if (st.status === "nominate" && isBot(turnTeam(st)) && now >= st.turnAt + NOM_DELAY) {
        var pick = botPick(st, turnTeam(st));
        if (!pick) { st.status = "done"; changed = true; break; }
        openLot(st, pick.id, turnTeam(st), st.turnAt + NOM_DELAY, st.simAll); changed = true; continue;
      }
      if (st.status === "nominate" && !isBot(turnTeam(st)) && now >= st.turnAt + NOM_LIMIT) {
        var auto = autoPick(st, turnTeam(st));
        if (!auto) { st.status = "done"; changed = true; break; }
        openLot(st, auto.id, turnTeam(st), st.turnAt + NOM_LIMIT, st.simAll); st.lot.auto = true; changed = true; continue;
      }
      if (st.status === "bidding") {
        var lot = st.lot, nb = nextBotBid(st, lot);
        if (nb && nb.at < lot.endsAt && nb.at <= now) { placeBid(lot, nb.team, nb.amt, nb.at); changed = true; continue; }
        if (now >= lot.endsAt) { st.result = { winner: lot.high.team, price: lot.high.amt }; st.status = "review"; changed = true; continue; }
      }
      // The pool ran dry before every roster was full, and the admin has since approved more players: carry on.
      if (st.status === "done" && pool(st).length && st.order.some(function (t) { return spotsLeft(st, t) > 0; })) {
        nextTurn(st, st.turn); changed = true; continue;
      }
      break;
    }
    return changed;
  }

  // A simulated coach nominates one of the better players left (seeded).
  function botPick(st, team) {
    var p = pool(st); if (!p.length) return null;
    p.sort(function (a, b) { return value(b, st.seed) - value(a, st.seed) || (a.id < b.id ? -1 : 1); });
    var g = rng(st.seed + "|nom|" + (st.sales.length + st.voided.length) + "|" + team);
    return p[Math.floor(g() * Math.min(8, p.length))];
  }

  // Nomination clock ran out: the coach's top starred player still available, else a random one (seeded).
  function autoPick(st, team) {
    var p = pool(st); if (!p.length) return null;
    var b = []; try { b = JSON.parse(localStorage.getItem("sgtbl-mock-board") || "[]"); } catch (e) {}
    if (team === ME) for (var i = 0; i < b.length; i++) { var hit = p.filter(function (r) { return r.id === b[i]; })[0]; if (hit) return hit; }
    p.sort(function (a, c) { return a.id < c.id ? -1 : 1; });
    return p[Math.floor(rng(st.seed + "|auto|" + (st.sales.length + st.voided.length) + "|" + team)() * p.length)];
  }

  function nextTurn(st, from) {
    st.lot = null; st.result = null;
    if (!pool(st).length) { st.status = "done"; return; }
    for (var k = 1; k <= st.order.length; k++) {
      var i = (from + k) % st.order.length;
      if (spotsLeft(st, st.order[i]) > 0) { st.turn = i; st.turnAt = Date.now(); st.status = "nominate"; return; }
    }
    st.status = "done";
  }
  function recordSale(st) {
    var lot = st.lot, res = st.result, r = player(lot.pid);
    st.sales.push({ n: lot.n, pid: lot.pid, name: r ? r.first + " " + r.last : lot.pid, team: res.winner, price: res.price,
      nominator: lot.nominator, bids: lot.bids.length, at: Date.now() });
    R.update(lot.pid, function (p) { p.status = "rostered"; p.team = res.winner; p.draftPrice = res.price;
      R.addLog(p, "Drafted by " + res.winner + " for $" + res.price + " (auction draft)"); });
    nextTurn(st, st.turn);
  }

  // ---- Actions (each loads, changes and saves; returns an error message or "") ----
  function act(fn) { var st = load(); step(st, Date.now()); var err = fn(st) || ""; if (!err) save(st); return err; }

  var api = {
    BUDGET: BUDGET, SPOTS: SPOTS, ME: ME, KEY: KEY, NOM_DELAY: NOM_DELAY, NOM_LIMIT: NOM_LIMIT, TOPUP: TOPUP,
    load: load, save: save, step: step, pool: pool, player: player, roster: roster, spent: spent, raise: raise, minNext: minNext,
    budgetLeft: budgetLeft, spotsLeft: spotsLeft, maxBid: maxBid, turnTeam: turnTeam, isBot: isBot,

    setSecs: function (s) { return act(function (st) { if (st.status !== "setup") return "The countdown length is set before the draft starts."; st.secs = s; }); },
    shuffle: function () { return act(function (st) {
      if (st.status !== "setup") return "The order is set before the draft starts.";
      var g = rng(Date.now()), o = st.order;
      for (var i = o.length - 1; i > 0; i--) { var j = Math.floor(g() * (i + 1)), t = o[i]; o[i] = o[j]; o[j] = t; }
    }); },
    start: function () { return act(function (st) {
      if (st.status !== "setup") return "The draft has already started.";
      if (!pool(st).length) return "No approved players to draft yet.";
      st.seed = Date.now(); st.turn = 0; st.turnAt = Date.now(); st.status = "nominate";
    }); },
    // Commissioner clock controls. Pausing freezes every countdown; resuming shifts them all by the paused time.
    pause: function () { return act(function (st) {
      if (st.status !== "nominate" && st.status !== "bidding") return "There's no clock running.";
      if (st.paused) return "Already paused."; st.paused = Date.now();
    }); },
    resume: function () { return act(function (st) {
      if (!st.paused) return "The draft isn't paused.";
      var p = st.paused, d = Date.now() - p; delete st.paused;
      st.turnAt += d;
      if (st.lot) { st.lot.startAt += d; st.lot.endsAt += d; st.lot.high.at += d; st.lot.bids.forEach(function (b) { if (b.at > p) b.at += d; }); }
    }); },
    addTime: function (secs) { return act(function (st) {
      secs = Math.floor(secs);
      if (!(secs >= 1 && secs <= 600)) return "Enter between 1 and 600 seconds.";
      var ms = secs * 1000, now = st.paused || Date.now();
      if (st.status === "bidding") st.lot.endsAt = Math.max(st.lot.endsAt, now) + ms;
      else if (st.status === "nominate") st.turnAt = Math.max(st.turnAt, now - (isBot(turnTeam(st)) ? NOM_DELAY : NOM_LIMIT)) + ms;
      else return "There's no clock running.";
    }); },
    nominate: function (pid, team) { return act(function (st) {
      if (st.paused) return "The draft is paused.";
      if (st.status !== "nominate") return "It isn't time to nominate.";
      if (team !== turnTeam(st)) return "It's the " + turnTeam(st) + "' turn to nominate.";
      if (!pool(st).some(function (r) { return r.id === pid; })) return "That player isn't available.";
      openLot(st, pid, team, Date.now());
    }); },
    bid: function (team, amt) { return act(function (st) {
      var lot = st.lot;
      if (st.paused) return "The draft is paused. Bidding opens again when the commissioner resumes.";
      if (st.status !== "bidding") return "Bidding is closed.";
      if (lot.teams.indexOf(team) < 0) return "Your roster is full.";
      if (lot.high.team === team) return "You're already the high bidder.";
      amt = Math.floor(amt);
      if (!(amt >= minNext(lot))) return "The next bid must be at least $" + minNext(lot) + ".";
      if (amt > maxBid(st, team)) return "Your max bid is $" + maxBid(st, team) + " (you need $1 for each other open roster spot).";
      placeBid(lot, team, amt, Date.now());
    }); },
    confirm: function () { return act(function (st) {
      if (st.status !== "review") return "Nothing to confirm.";
      recordSale(st);
    }); },
    voidLot: function () { return act(function (st) {
      if (st.status !== "review" && st.status !== "bidding") return "Nothing to void.";
      var r = player(st.lot.pid);
      st.voided.push({ n: st.lot.n, pid: st.lot.pid, name: r ? r.first + " " + r.last : st.lot.pid, nominator: st.lot.nominator, at: Date.now() });
      st.lot = null; st.result = null; st.status = "nominate"; st.turnAt = Date.now();   // same coach nominates again
    }); },
    finish: function () { return act(function (st) {
      if (st.status !== "done") return "The draft isn't finished.";
      st.status = "final"; R.setPhase("inseason");
    }); },
    // Demo helper: plays out every remaining lot instantly (the Knicks bid like the simulated coaches) and confirms each sale.
    simulate: function () { return act(function (st) {
      if (st.status === "setup") { st.seed = Date.now(); st.turn = 0; st.turnAt = Date.now(); st.status = "nominate"; }
      delete st.paused; st.simAll = true; var guard = 0;
      if (st.lot && st.status === "bidding") st.lot.lim = Object.assign(limits(st, st.lot, true), st.lot.lim);
      while (guard++ < 400 && st.status !== "done" && st.status !== "final") {
        if (st.status === "nominate") { var p = botPick(st, turnTeam(st)); if (!p) { st.status = "done"; break; } openLot(st, p.id, turnTeam(st), Date.now(), true); }
        if (st.status === "bidding") step(st, Infinity);
        if (st.status === "review") recordSale(st);
      }
      delete st.simAll;
    }); },
    // Undo the whole draft: drafted players go back to the pool.
    reset: function () {
      var st = load();
      st.sales.forEach(function (s) { R.update(s.pid, function (p) {
        if (p.status === "rostered") { p.status = "approved"; p.team = ""; }
        delete p.draftPrice; p.log = p.log.filter(function (l) { return l[1].indexOf("(auction draft)") < 0; });
      }); });
      if (st.status === "final") R.setPhase("preseason");
      try { localStorage.removeItem(KEY); localStorage.removeItem("sgtbl-mock-draft-v1"); } catch (e) {}
    }
  };
  window.SGTBLDraft = api;
})();
