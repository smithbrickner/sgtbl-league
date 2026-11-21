/* SGTBL registrations: PROTOTYPE data layer.
   Stands in for the real database (planned: Supabase). Everything lives in this browser's localStorage under one key,
   so the public form, the League Admin Registrations page, the Team Portal Player Pool and the auction draft
   (draft.js) all see the same records on this computer. Nothing is sent anywhere. Sample players are fictional.

   Record lifecycle:
     status:  submitted -> approved -> (claim -> rostered) | declined
     payment: unpaid | paid | assistance-requested | assistance-granted
   An approved, unrostered player is in the DRAFT POOL while the league phase is "preseason" and in the FREE-AGENT POOL
   once the phase is "inseason" (draft complete). */
(function () {
  var KEY = "sgtbl-mock-registrations-v2", PHASE_KEY = "sgtbl-mock-phase";
  var TEAMS = ["Knicks", "Eagles", "Sharks", "Wolves", "Tigers", "Rams"];

  function rec(o) {
    return Object.assign({ church: "Smithtown Gospel Tabernacle", heard: "", conflicts: "", medical: "", open: "", aid: false,
      payment: "paid", status: "submitted", team: "", bid: 0, svId: "", log: [] }, o);
  }
  var SEED = [
    rec({ id: "SGT-0001", submitted: "2026-11-02", first: "Andre", last: "Whitfield", email: "andre.w@example.com", phone: "(631) 555-0141", heard: "Church announcement",
      pos: ["PG", "SG"], ht: "6-1", hand: "Right", level: "High school", jersey: "L", nums: ["3", "11", "Random"], conflicts: "Out Dec 26 (family trip)",
      ecName: "Lisa Whitfield", ecPhone: "(631) 555-0142", faith: "Yes", status: "approved", svId: "",
      log: [["2026-11-02", "Registered"], ["2026-11-02", "Paid $100"], ["2026-11-03", "Approved by League Admin"]] }),
    rec({ id: "SGT-0002", submitted: "2026-11-03", first: "Marcus", last: "Delaney", email: "mdelaney@example.com", phone: "(631) 555-0153", heard: "A friend or family member",
      pos: ["C", "PF"], ht: "6-8", hand: "Right", level: "College (club or intramural)", jersey: "2XL", nums: ["34", "50", "Random"],
      ecName: "Dana Delaney", ecPhone: "(631) 555-0154", medical: "Asthma (inhaler in bag)", faith: "Yes", status: "approved",
      log: [["2026-11-03", "Registered"], ["2026-11-03", "Paid $100"], ["2026-11-04", "Approved by League Admin"]] }),
    rec({ id: "SGT-0003", submitted: "2026-11-05", first: "Jonah", last: "Park", email: "jonah.park@example.com", phone: "(516) 555-0167", heard: "Social media", church: "NA",
      pos: ["SG", "SF"], ht: "6-3", hand: "Left", level: "College (varsity) or higher", jersey: "L", nums: ["24", "8", "23"],
      ecName: "Grace Park", ecPhone: "(516) 555-0168", faith: "Not sure", open: "Yes", status: "approved",
      log: [["2026-11-05", "Registered"], ["2026-11-05", "Paid $100"], ["2026-11-06", "Approved by League Admin"]] }),
    rec({ id: "SGT-0004", submitted: "2026-11-08", first: "Tyrell", last: "Owens", email: "towens@example.com", phone: "(631) 555-0179", heard: "Flyer or poster",
      pos: ["SF", "PF"], ht: "6-5", hand: "Right", level: "Pickup / recreational", jersey: "XL", nums: ["Random"], conflicts: "Works late most Thursdays in January",
      ecName: "Monica Owens", ecPhone: "(631) 555-0180", faith: "No", open: "Maybe later", aid: true, payment: "assistance-granted", status: "approved",
      log: [["2026-11-08", "Registered"], ["2026-11-08", "Requested fee assistance"], ["2026-11-09", "Fee assistance granted"], ["2026-11-09", "Approved by League Admin"]] }),
    rec({ id: "SGT-0005", submitted: "2026-11-12", first: "Caleb", last: "Morrison", email: "caleb.m@example.com", phone: "(631) 555-0191", heard: "Church announcement",
      pos: ["PG"], ht: "5-10", hand: "Right", level: "High school", jersey: "M", nums: ["1", "5", "Random"],
      ecName: "Ruth Morrison", ecPhone: "(631) 555-0192", faith: "Yes",
      log: [["2026-11-12", "Registered"], ["2026-11-12", "Paid $100"]] }),
    rec({ id: "SGT-0006", submitted: "2026-11-14", first: "Daniel", last: "Okoro", email: "dokoro@example.com", phone: "(631) 555-0113", heard: "A friend or family member",
      pos: ["PF", "C"], ht: "6-7", hand: "Right", level: "College (club or intramural)", jersey: "2XL", nums: ["21", "33", "Random"],
      ecName: "Esther Okoro", ecPhone: "(631) 555-0114", faith: "Yes", payment: "unpaid",
      log: [["2026-11-14", "Registered (fee not paid yet)"]] }),
    rec({ id: "SGT-0007", submitted: "2026-11-16", first: "Luis", last: "Ferreira", email: "luis.ferreira@example.com", phone: "(516) 555-0125", heard: "Social media", church: "NA",
      pos: ["SG"], ht: "6-0", hand: "Right", level: "Pickup / recreational", jersey: "M", nums: ["7", "17", "Random"], conflicts: "Away Feb 12 and Feb 19",
      ecName: "Ana Ferreira", ecPhone: "(516) 555-0126", faith: "Not sure", open: "Yes", aid: true, payment: "assistance-requested",
      log: [["2026-11-16", "Registered"], ["2026-11-16", "Requested fee assistance"]] }),
    rec({ id: "SGT-0008", submitted: "2026-11-17", first: "Ben", last: "Harlow", email: "bharlow@example.com", phone: "(631) 555-0137", heard: "Church announcement",
      pos: ["SF"], ht: "6-4", hand: "Left", level: "High school", jersey: "L", nums: ["12", "Random"],
      ecName: "Karen Harlow", ecPhone: "(631) 555-0138", faith: "Yes",
      log: [["2026-11-17", "Registered"], ["2026-11-17", "Paid $100"]] }),
    rec({ id: "SGT-0009", submitted: "2026-11-01", first: "Isaiah", last: "Grant", email: "igrant@example.com", phone: "(631) 555-0149", heard: "A friend or family member",
      pos: ["PG", "SG"], ht: "6-2", hand: "Right", level: "College (varsity) or higher", jersey: "L", nums: ["0", "10", "Random"],
      ecName: "Denise Grant", ecPhone: "(631) 555-0150", faith: "Yes", status: "approved", svId: "4f1c2b7e-8d3a-4e61-9b2f-0c5a7d9e1f23",
      log: [["2026-11-01", "Registered"], ["2026-11-01", "Paid $100"], ["2026-11-02", "Approved by League Admin"], ["2026-11-11", "SportsVisio profile linked"]] })
  ];

  // 45 more fictional, already-approved players so the auction draft has a full pool:
  // 50 approved in all, plus 4 still awaiting review (6 teams x 9 = 54 roster spots, so the admin approves those 4 to fill every roster).
  // "Name|positions|height|level|shooting hand"  level: V varsity+, C college club, H high school, P pickup
  var LV = { V: "College (varsity) or higher", C: "College (club or intramural)", H: "High school", P: "Pickup / recreational" };
  var SIZES = { PG: "M", SG: "L", SF: "L", PF: "XL", C: "2XL" };
  var HEARD = ["Church announcement", "A friend or family member", "Social media", "Flyer or poster"];
  ("Nathan Cole|PG|5-11|H|R;Elijah Brooks|SG,SF|6-3|C|R;Marco Bianchi|SF|6-4|H|R;Derek Lindqvist|C|6-9|V|R;Samuel Adeyemi|PF,C|6-7|C|R;" +
   "Aaron Feldman|PG,SG|6-0|P|R;Kevin Tran|SG|5-10|H|L;Christopher Hale|SF,PF|6-5|V|R;Jordan Pierce|PG|6-1|C|R;Micah Bennett|SG|6-2|H|R;" +
   "Owen Gallagher|PF|6-6|C|R;Ryan Castillo|SF|6-3|P|R;Terrence Wallace|C|6-8|H|R;Gabriel Nunez|PG|5-9|P|R;Patrick Doyle|PF,C|6-7|H|L;" +
   "Simon Achebe|SG,SF|6-4|V|R;Joshua Kim|PG,SG|5-11|C|R;Victor Santos|SF|6-5|H|R;Mason Reid|SG|6-1|P|R;Nicholas Petrov|C|6-10|C|R;" +
   "Darius Coleman|PF|6-6|V|R;Ethan Walsh|SF,PF|6-4|H|R;Matthew Osei|PG|6-0|H|R;Brandon Hughes|SG|6-2|C|L;Peter Novak|PF|6-7|P|R;" +
   "Isaac Mendel|SF|6-3|H|R;Trevor Banks|C|6-8|C|R;Dominic Russo|PG,SG|6-1|V|R;Corey Jenkins|SG,SF|6-3|P|R;Felix Moreau|PF|6-5|H|R;" +
   "Joel Andersen|C|6-9|H|R;Malik Hayes|PG|6-0|C|R;Stephen Clarke|SF|6-4|P|L;Adrian Vega|SG|6-1|H|R;Gideon Mensah|PF,C|6-8|C|R;" +
   "Lucas Hartmann|SF,PF|6-6|H|R;Reggie Dunn|PG|5-10|P|R;Tobias Lang|SG,SF|6-3|C|R;Wesley Barnes|C|6-7|H|R;Henry Caldwell|PF|6-5|P|R;" +
   "Andrew Silva|PG,SG|6-0|H|R;Cameron Price|SF|6-4|C|R;Noah Fitzgerald|SG|6-2|H|R;Julian Ortiz|PF|6-6|V|R;Kofi Asante|C|6-8|H|R")
  .split(";").forEach(function (row, i) {
    var f = row.split("|"), nm = f[0].split(" "), pos = f[1].split(","), n = 10 + i, day = String(1 + (i * 7) % 18).padStart(2, "0");
    var date = "2026-11-" + day, ph = "(631) 555-" + String(200 + i * 2), aid = i % 15 === 7;
    SEED.push(rec({ id: "SGT-" + String(n).padStart(4, "0"), submitted: date, first: nm[0], last: nm[1],
      email: (nm[0] + "." + nm[1]).toLowerCase() + "@example.com", phone: ph, heard: HEARD[i % 4], church: i % 6 === 5 ? "NA" : "Smithtown Gospel Tabernacle",
      pos: pos, ht: f[2], hand: f[4] === "L" ? "Left" : "Right", level: LV[f[3]], jersey: SIZES[pos[0]], nums: [String((i * 7 + 2) % 60), "Random"],
      ecName: "Family contact", ecPhone: "(631) 555-" + String(201 + i * 2), faith: ["Yes", "Yes", "Not sure", "No"][i % 4], open: i % 4 >= 2 ? "Yes" : "",
      aid: aid, payment: aid ? "assistance-granted" : "paid", status: "approved",
      log: [[date, "Registered"], [date, aid ? "Fee assistance granted" : "Paid $100"], [date, "Approved by League Admin"]] }));
  });

  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return JSON.parse(JSON.stringify(SEED));
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  function phase() { try { return localStorage.getItem(PHASE_KEY) || "preseason"; } catch (e) { return "preseason"; } }
  function setPhase(p) { try { localStorage.setItem(PHASE_KEY, p); } catch (e) {} }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  // Where an approved, unrostered player sits right now.
  function pool(r, ph) {
    if (r.status !== "approved" && r.status !== "claim") return "";
    return (ph || phase()) === "preseason" ? "draft" : "fa";
  }
  function update(id, fn) {
    var list = load(), r = list.filter(function (x) { return x.id === id; })[0];
    if (!r) return null;
    fn(r); save(list); return r;
  }
  function addLog(r, text) { r.log.push([today(), text]); }

  // A submission from the public registration form (register.html). Re-submitting from the same tab updates it.
  function upsertFromForm(d, existingId) {
    var list = load(), r = existingId && list.filter(function (x) { return x.id === existingId; })[0];
    var fields = {
      first: d.first, last: d.last, email: d.email, phone: d.phone, church: d.church, heard: d.heard || "",
      pos: String(d.pos || "").split(", ").filter(Boolean), ht: (d.htft || "") + "-" + (d.htin || ""), hand: d.hand, level: d.level,
      jersey: d.jersey, nums: [d.num1, d.num2, d.num3].filter(Boolean), conflicts: d.conflicts || "", ecName: d.ecName, ecPhone: d.ecPhone,
      medical: d.medical || "", faith: d.faith, open: d.open || "", aid: !!d.aid,
      payment: d.aid ? "assistance-requested" : "unpaid"
    };
    if (r && r.status === "submitted") { Object.assign(r, fields); addLog(r, "Details edited by player"); }
    else {
      var n = list.reduce(function (m, x) { return Math.max(m, parseInt(x.id.slice(4), 10) || 0); }, 0) + 1;
      r = rec(Object.assign({ id: "SGT-" + String(n).padStart(4, "0"), submitted: today() }, fields));
      addLog(r, "Registered on the website" + (d.aid ? "; requested fee assistance" : ""));
      list.push(r);
    }
    save(list); return r.id;
  }

  // SportsVisio profile links look like https://uh.sportsvisio.com/league/<league>/player/<uuid>
  function parseSvId(text) {
    var m = String(text || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m ? m[0].toLowerCase() : "";
  }

  var POS = { PG: "Point Guard", SG: "Shooting Guard", SF: "Small Forward", PF: "Power Forward", C: "Center" };
  function fmtHt(ht) { var p = String(ht || "").split("-"); return p[0] ? p[0] + "′ " + (p[1] || 0) + "″" : ""; }
  function fmtDate(iso) { var d = new Date(iso + "T12:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  window.SGTBLReg = {
    TEAMS: TEAMS, POS: POS, load: load, save: save, phase: phase, setPhase: setPhase, pool: pool, update: update, addLog: addLog,
    upsertFromForm: upsertFromForm, parseSvId: parseSvId, fmtHt: fmtHt, fmtDate: fmtDate, esc: esc,
    reset: function () { try { localStorage.removeItem(KEY); localStorage.removeItem(PHASE_KEY); localStorage.removeItem("sgtbl-mock-board"); localStorage.removeItem("sgtbl-mock-draft-v1"); } catch (e) {} },
    // The coach persona's FAAB: $100 per season, $14 already spent (matches the Free Agency page).
    faabLeft: function (team) { var spent = team === "Knicks" ? 14 : 0; load().forEach(function (r) { if (r.team === team && r.status !== "declined") spent += r.bid || 0; }); return 100 - spent; }
  };
})();
