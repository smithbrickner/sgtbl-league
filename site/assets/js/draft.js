/* SGTBL auction draft: PROTOTYPE engine shared by the League Admin Draft Suite (admin/draft.html) and the
   Team Portal Draft Room (captain/draft-room.html). State lives in this browser's localStorage, so open both pages
   (two tabs) and they stay in sync. The player pool comes from registrations.js (approved + fee settled).

   Rules modelled (user, 2026-11-21):
   - Every team has a one-time $1,000 draft budget and 9 roster spots.
   - Coaches take turns nominating, in a set order (teams with full rosters are skipped). The nominator opens at $1.
   - Bids are sealed: during the countdown everyone sees only WHO has bid, never how much. When time runs out every
     team's bid is revealed to everyone.
   - Max bid = budget left - $1 for each other roster spot still to fill.
   - Tied top bids go to another countdown round between the tied teams only. A tied team that doesn't re-bid stays
     at the tied amount; new bids must be at least that amount.
   - If the tied teams are all at their max bid (nobody can go higher), the League Admin picks the winner.
   - The League Admin confirms each sale (or voids it, which returns the player to the pool).
   The 5 teams other than the coach persona's Knicks are SIMULATED: their nominations and bids are generated from a
   seeded random generator, so every open tab computes exactly the same result. */
(function () {
  var R = window.SGTBLReg, KEY = "sgtbl-mock-draft-v1";
  var BUDGET = 1000, SPOTS = 9, ME = "Knicks", NOM_DELAY = 4000, GAP = 1500;

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
  function roundBid(x) { return x > 20 ? Math.round(x / 5) * 5 : Math.round(x); }

  // Sealed bids from the simulated coaches for one round. Each bid has the time it's submitted ("at").
  function botBids(st, lot, includeMe) {
    var out = {}, r = player(lot.pid); if (!r) return out;
    lot.teams.forEach(function (t) {
      if (!isBot(t) && !includeMe) return;
      var g = rng(st.seed + "|" + lot.n + "|" + lot.round + "|" + t), mb = maxBid(st, t), amt;
      if (mb < lot.min) return;
      if (lot.round === 1) {
        if (g() > 0.72) return;                                    // not interested
        var perSpot = budgetLeft(st, t) / spotsLeft(st, t);
        amt = roundBid(value(r, st.seed) * (0.6 + 0.75 * g()));
        amt = Math.min(amt, Math.round(perSpot * 2.6));
      } else {
        if (g() > 0.65) return;                                    // stands at the tied amount
        amt = lot.min + 1 + Math.floor(g() * 15);
      }
      amt = Math.max(lot.min, Math.min(amt, mb));
      if (lot.round === 1 && t === lot.nominator && amt <= 1) return; // keeps the opening $1
      out[t] = { amt: amt, at: lot.startAt + Math.round((0.15 + 0.7 * g()) * st.secs * 1000) };
    });
    return out;
  }

  function openLot(st, pid, nominator, at, includeMe) {
    var teams = st.order.filter(function (t) { return spotsLeft(st, t) > 0; });
    var lot = { n: st.sales.length + st.voided.length + 1, pid: pid, nominator: nominator, round: 1, teams: teams, min: 1,
      startAt: at, endsAt: at + st.secs * 1000, bids: {}, carry: {}, rounds: [] };
    lot.bids[nominator] = { amt: 1, at: at, opening: true };
    var bb = botBids(st, lot, includeMe); Object.keys(bb).forEach(function (t) { lot.bids[t] = bb[t]; });
    st.lot = lot; st.result = null; st.status = "bidding";
  }

  // The bids that count for the round just ended (tied teams that didn't re-bid keep the tied amount).
  function finalBids(lot) {
    var out = {};
    lot.teams.forEach(function (t) {
      var b = lot.bids[t];
      if (b && b.at <= lot.endsAt) out[t] = b.amt;
      else if (lot.carry[t] != null) out[t] = lot.carry[t];
    });
    return out;
  }
  function leaders(fb) {
    var max = 0, top = [];
    Object.keys(fb).forEach(function (t) { if (fb[t] > max) { max = fb[t]; top = [t]; } else if (fb[t] === max) top.push(t); });
    return { max: max, teams: top };
  }

  // Moves the draft forward in time. Deterministic: every tab gets the same answer from the same state.
  function step(st, now) {
    var changed = false, guard = 0;
    while (guard++ < 50) {
      if (st.status === "nominate" && isBot(turnTeam(st)) && now >= st.turnAt + NOM_DELAY) {
        var pick = botPick(st, turnTeam(st));
        if (!pick) { st.status = "done"; changed = true; break; }
        openLot(st, pick.id, turnTeam(st), st.turnAt + NOM_DELAY); changed = true; continue;
      }
      if (st.status === "bidding" && now >= st.lot.endsAt) {
        var lot = st.lot, fb = finalBids(lot), top = leaders(fb);
        lot.rounds.push({ round: lot.round, bids: fb });
        // Tied, but no tied team has room to bid higher: another round can't settle it, so the League Admin decides.
        if (top.teams.length > 1 && !top.teams.some(function (t) { return maxBid(st, t) > top.max; })) {
          st.result = { winner: null, tied: top.teams, price: top.max }; st.status = "review";
        } else if (top.teams.length > 1) {
          lot.round++; lot.teams = top.teams; lot.min = top.max; lot.carry = {};
          top.teams.forEach(function (t) { lot.carry[t] = top.max; });
          lot.startAt = lot.endsAt + GAP; lot.endsAt = lot.startAt + st.secs * 1000; lot.bids = {};
          var bb = botBids(st, lot, st.simAll); Object.keys(bb).forEach(function (t) { lot.bids[t] = bb[t]; });
        } else {
          st.result = { winner: top.teams[0], price: top.max }; st.status = "review";
        }
        changed = true; continue;
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

  function nextTurn(st, from) {
    st.lot = null; st.result = null;
    if (!pool(st).length) { st.status = "done"; return; }
    for (var k = 1; k <= st.order.length; k++) {
      var i = (from + k) % st.order.length;
      if (spotsLeft(st, st.order[i]) > 0) { st.turn = i; st.turnAt = Date.now(); st.status = "nominate"; return; }
    }
    st.status = "done";
  }

  // ---- Actions (each loads, changes and saves; returns an error message or "") ----
  function act(fn) { var st = load(); step(st, Date.now()); var err = fn(st) || ""; if (!err) save(st); return err; }

  var api = {
    BUDGET: BUDGET, SPOTS: SPOTS, ME: ME, KEY: KEY,
    load: load, save: save, step: step, pool: pool, player: player, roster: roster, spent: spent,
    budgetLeft: budgetLeft, spotsLeft: spotsLeft, maxBid: maxBid, turnTeam: turnTeam, isBot: isBot, finalBids: finalBids,

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
    nominate: function (pid, team) { return act(function (st) {
      if (st.status !== "nominate") return "It isn't time to nominate.";
      if (team !== turnTeam(st)) return "It's the " + turnTeam(st) + "' turn to nominate.";
      if (!pool(st).some(function (r) { return r.id === pid; })) return "That player isn't available.";
      openLot(st, pid, team, Date.now());
    }); },
    bid: function (team, amt) { return act(function (st) {
      var lot = st.lot;
      if (st.status !== "bidding") return "Bidding is closed.";
      if (lot.teams.indexOf(team) < 0) return "Your team isn't in this round.";
      amt = Math.floor(amt);
      if (!(amt >= lot.min)) return "Your bid must be at least $" + lot.min + ".";
      if (amt > maxBid(st, team)) return "Your max bid is $" + maxBid(st, team) + " (you need $1 for each other open roster spot).";
      lot.bids[team] = { amt: amt, at: Date.now() };
    }); },
    // A tie nobody can raise: the League Admin picks the winner (e.g. by coin flip), then confirms.
    award: function (team) { return act(function (st) {
      if (st.status !== "review" || st.result.winner || st.result.tied.indexOf(team) < 0) return "Nothing to award.";
      st.result.winner = team; st.result.awarded = true;
    }); },
    confirm: function () { return act(function (st) {
      if (st.status !== "review") return "Nothing to confirm.";
      if (!st.result.winner) return "Choose the winner of the tie first.";
      var lot = st.lot, res = st.result, r = player(lot.pid);
      st.sales.push({ n: lot.n, pid: lot.pid, name: r ? r.first + " " + r.last : lot.pid, team: res.winner, price: res.price,
        nominator: lot.nominator, rounds: lot.rounds, at: Date.now() });
      R.update(lot.pid, function (p) { p.status = "rostered"; p.team = res.winner; p.draftPrice = res.price;
        R.addLog(p, "Drafted by " + res.winner + " for $" + res.price + " (auction draft)"); });
      nextTurn(st, st.turn);
    }); },
    voidLot: function () { return act(function (st) {
      if (st.status !== "review" && st.status !== "bidding") return "Nothing to void.";
      var r = player(st.lot.pid);
      st.voided.push({ n: st.lot.n, pid: st.lot.pid, name: r ? r.first + " " + r.last : st.lot.pid, nominator: st.lot.nominator, rounds: st.lot.rounds, at: Date.now() });
      st.lot = null; st.result = null; st.status = "nominate"; st.turnAt = Date.now();   // same coach nominates again
    }); },
    finish: function () { return act(function (st) {
      if (st.status !== "done") return "The draft isn't finished.";
      st.status = "final"; R.setPhase("inseason");
    }); },
    // Demo helper: plays out every remaining lot instantly (the Knicks bid like the simulated coaches) and confirms each sale.
    simulate: function () { return act(function (st) {
      if (st.status === "setup") { st.seed = Date.now(); st.turn = 0; st.turnAt = Date.now(); st.status = "nominate"; }
      st.simAll = true; var guard = 0;
      while (guard++ < 200 && st.status !== "done" && st.status !== "final") {
        if (st.status === "nominate") { var p = botPick(st, turnTeam(st)); if (!p) { st.status = "done"; break; } openLot(st, p.id, turnTeam(st), Date.now(), true); }
        if (st.status === "bidding") { var g2 = 0; while (st.status === "bidding" && g2++ < 20) { if (st.lot.round > 6) { var room = st.lot.teams.filter(function (t) { return maxBid(st, t) > st.lot.min; })[0]; if (room) st.lot.bids[room] = { amt: st.lot.min + 1, at: st.lot.startAt }; } step(st, st.lot.endsAt); } }
        if (st.status === "review") {
          if (!st.result.winner) st.result.winner = st.result.tied[0];
          var lot = st.lot, res = st.result, r = player(lot.pid);
          st.sales.push({ n: lot.n, pid: lot.pid, name: r ? r.first + " " + r.last : lot.pid, team: res.winner, price: res.price, nominator: lot.nominator, rounds: lot.rounds, at: Date.now() });
          R.update(lot.pid, function (x) { x.status = "rostered"; x.team = res.winner; x.draftPrice = res.price; R.addLog(x, "Drafted by " + res.winner + " for $" + res.price + " (auction draft)"); });
          nextTurn(st, st.turn);
        }
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
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
  window.SGTBLDraft = api;
})();
