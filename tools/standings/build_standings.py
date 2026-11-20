"""Builds the public standings page (ranked by league points: W 3, T 1, L 0 - see standings_core.py) (site/standings.html) in the style of a pro-league standings page
(Standings / Expanded / Vs. Division views, sortable columns, glossary) from the real Draft-division schedule:

  tools/recaps/schedule.json   full schedule and results, home team first ("status": "pending" = film in, no score yet)

The page's head, nav and footer are kept from the current site/standings.html. Run:  python tools/standings/build_standings.py
"""
import html, json, os, re
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SITE = os.path.join(REPO, 'site')
PLAYOFF_SPOTS = 3            # league rule: the top three make the playoffs (dashed line)

from standings_core import TEAMS
RECAPS = {'2026-10-22': 'game-oct22.html', '2026-10-29': 'game-oct29.html', '2026-11-05': 'game.html'}   # Team Jeremy's recaps

def e(s): return html.escape(str(s), quote=True)
def short(iso): x = date.fromisoformat(iso); return f"{x.strftime('%a')}, {x.strftime('%b')} {x.day}"
def logo(t): code, color = TEAMS[t]; return f'<span class="st-logo" style="background:{color}">{code}</span>'
def tname(t): return '<a href="team.html">Team Jeremy</a>' if t == 'Team Jeremy' else e(t)
def pct_txt(p): return f"{p:.3f}".lstrip('0') if p < 1 else '1.000'
def signed(x, dp=1):
    v = f"{abs(x) + 1e-9:.{dp}f}"
    return '0.0' if float(v) == 0 else ('+' if x > 0 else '&minus;') + v

from standings_core import compute, load_schedule, gp, rec, split_txt, split_pts, diff, streak, write_json, WIN, TIE

games = load_schedule()
played = [g for g in games if g.get('hs') is not None]
pending = [g for g in games if g.get('status') == 'pending']
S, order, any_ties, flips = compute(games)
def ppg(r): return r['pf'] / gp(r) if gp(r) else 0
def oppg(r): return r['pa'] / gp(r) if gp(r) else 0
def lastn(r, n=5): x = r['res'][-n:]; return (x.count('W'), x.count('L'), x.count('T'))
FORM = {0: ('w', '&#10003;', 'W'), 1: ('l', '&#10005;', 'L'), 2: ('t', '&ndash;', 'T')}   # game result k: 0 win, 1 loss, 2 tie
def form(r, n=5):
    last = r['games'][-n:]
    icons = []
    for x in last:
        cls, glyph, letter = FORM[x['k']]
        where = 'vs' if x['home'] else '@'
        icons.append(f'<span class="st-form st-form-{cls}" title="{letter} {x["us"]}-{x["them"]} {where} {TEAMS[x["opp"]][0]}, {short(x["date"])}" aria-hidden="true">{glyph}</span>')
    label = 'Last ' + str(len(last)) + ', oldest first: ' + ', '.join({0: 'win', 1: 'loss', 2: 'tie'}[x['k']] for x in last) if last else 'No games yet'
    return f'<span class="st-forms" role="img" aria-label="{label}">' + ''.join(icons) + '</span>'
top = S[order[0]]['pts']
def back(r): x = top - r['pts']; return ('&ndash;', 0) if x == 0 else (str(x), x)

# ---------- expanded splits ----------
def split(r, cond):
    out = [0, 0, 0]
    for x in r['games']:
        if cond(x): out[x['k']] += 1
    return tuple(out)
winning = {t for t in TEAMS if S[t]['w'] > S[t]['l']}
def remaining(t): return [g for g in games if g.get('hs') is None and t in (g['home'], g['away'])]
def next_game(t):
    up = [g for g in remaining(t) if g.get('status') != 'pending']
    if not up: return '&ndash;', '9999'
    g = up[0]; opp = g['away'] if g['home'] == t else g['home']; where = 'vs' if g['home'] == t else '@'
    return f"{short(g['date'])} {where} {TEAMS[opp][0]}", g['date']
def sp(wlt): return split_txt(wlt, any_ties), f"{split_pts(wlt):.3f}"

# ================= tables =================
def head(cells): return '<tr>' + ''.join(cells) + '</tr>'
def th(label, title, sort=True, cls='num'): return f'<th scope="col" class="{cls}" title="{e(title)}"' + (' aria-sort="none"' if sort else '') + f'>{label}</th>'
def team_th(): return '<th scope="col" class="st-team-h" aria-sort="none">Team</th>'
def team_cell(t, i): return f'<th scope="row" class="st-team" data-sort-value="{e(t)}"><span class="st-rank">{i + 1}</span>{logo(t)}<span class="st-name">{tname(t)}</span><span class="st-abbr">{TEAMS[t][0]}</span></th>'
def td(v, sortv=None, cls='num'): return f'<td class="{cls}"' + (f' data-sort-value="{sortv}"' if sortv is not None else '') + f'>{v}</td>'

rows1, rows2, rows3 = [], [], []
for i, t in enumerate(order):
    r = S[t]; sk, sv = streak(r); b_txt, b_val = back(r); dv = diff(r)
    cut = ' class="st-cut"' if i == PLAYOFF_SPOTS - 1 else ''
    hm, aw, l5 = sp(tuple(r['home'])), sp(tuple(r['away'])), sp(lastn(r))
    rows1.append(f'            <tr{cut}>' + team_cell(t, i) + td(r['w']) + td(r['l']) + td(r['t']) + td(r['pts'], cls='num st-ptscol') + td(b_txt, b_val)
                 + td(hm[0], hm[1]) + td(aw[0], aw[1]) + td(f"{ppg(r):.1f}") + td(f"{oppg(r):.1f}")
                 + td(signed(dv), f"{dv:.3f}", 'num ' + ('st-pos' if dv > 0 else 'st-neg' if dv < 0 else '')) + td(sk, sv) + td(form(r), l5[1], 'st-formcell') + '</tr>')
    close = sp(split(r, lambda x: abs(x['us'] - x['them']) <= 5)); blow = sp(split(r, lambda x: abs(x['us'] - x['them']) >= 15))
    vs500 = sp(split(r, lambda x: x['opp'] in winning)); left = len(remaining(t)); nx, nxs = next_game(t)
    tot = r['pf'] - r['pa']
    rows2.append(f'            <tr{cut}>' + team_cell(t, i) + td(gp(r)) + td(r['pf']) + td(r['pa']) + td(signed(tot, 0), tot, 'num ' + ('st-pos' if tot > 0 else 'st-neg' if tot < 0 else ''))
                 + td(close[0], close[1]) + td(blow[0], blow[1]) + td(vs500[0], vs500[1]) + td(left) + td(nx, nxs, 'st-next') + '</tr>')
    cells = []
    for o in order:
        if o == t: cells.append('<td class="st-self" aria-label="same team">&mdash;</td>'); continue
        h = r['h2h'].get(o)
        if not h: cells.append('<td class="num st-none">&middot;</td>'); continue
        cls = 'st-h2h-w' if h[0] > h[1] else 'st-h2h-l' if h[1] > h[0] else ''
        cells.append(f'<td class="num {cls}">{split_txt(h, any_ties)}</td>')
    rows3.append(f'            <tr>' + team_cell(t, i) + ''.join(cells) + td(rec(r, any_ties)) + td(r['pts']) + '</tr>')

h1 = head([team_th(), th('W', 'Wins'), th('L', 'Losses'), th('T', 'Ties'), th('PTS', 'League points: 3 for a win, 1 for a tie'), th('BACK', 'League points behind first place'),
           th('HOME', 'Home record'), th('AWAY', 'Away record'), th('PPG', 'Points per game'), th('OPP PPG', 'Opponent points per game'),
           th('DIFF', 'Average point differential'), th('STRK', 'Current streak'), th('LAST 5', 'Last five results, oldest to newest: check = win, dash = tie, X = loss', cls='st-formcell')])
h2 = head([team_th(), th('GP', 'Games played'), th('PF', 'Total points scored'), th('PA', 'Total points allowed'), th('DIFF', 'Total point differential'),
           th('CLOSE', 'Record in games decided by 5 points or fewer'), th('15+', 'Record in games decided by 15 points or more'),
           th('VS WIN%', 'Record against teams with more wins than losses'), th('LEFT', 'Regular-season games remaining'), th('NEXT', 'Next game', cls='st-next')])
h3 = head(['<th scope="col" class="st-team-h">Team</th>'] + [f'<th scope="col" class="num" title="{e(o)}">{logo(o)}<span class="st-vs-code">{TEAMS[o][0]}</span></th>' for o in order]
          + [th('W-L' + ('-T' if any_ties else ''), 'Overall record', sort=False), th('PTS', 'League points', sort=False)])

def table(h, rows, label, sortable=True):
    return (f'        <div class="st-scroll"><table class="st-table"{" data-sortable" if sortable else ""} aria-label="{e(label)}">\n'
            f'          <thead>{h}</thead>\n          <tbody>\n' + '\n'.join(rows) + '\n          </tbody>\n        </table></div>')

through = max(g['date'] for g in played)
pend_note = ''.join(f' {e(g["home"])} vs. {e(g["away"])} ({short(g["date"])}) has film in but no score yet, so it isn\'t counted.' for g in pending)
flip_note = ''.join(f' {", ".join(e(x) for x in grp)} are level on every tiebreaker, so their order would be decided by a coin flip.' for grp in flips)
glossary = [('W', 'Wins'), ('L', 'Losses'), ('T', 'Ties'), ('PTS', 'League points: 3 for a win, 1 for a tie, 0 for a loss'), ('BACK', 'League points behind first place'),
            ('HOME', 'Home record'), ('AWAY', 'Away record'), ('PPG', 'Points per game'), ('OPP PPG', 'Opponent points per game'),
            ('DIFF', 'Average point differential (Expanded: total)'), ('STRK', 'Current streak'), ('LAST 5', 'Last five results, oldest to newest: green check = win, yellow dash = tie, red X = loss'), ('GP', 'Games played'),
            ('PF / PA', 'Total points scored / allowed'), ('CLOSE', 'Record in games decided by 5 or fewer'), ('15+', 'Record in games decided by 15 or more'),
            ('VS WIN%', 'Record against teams with more wins than losses'), ('LEFT', 'Regular-season games left')]

main = f'''
<main id="main">
  <div class="wrap st-wrap">
    <section class="card st-card">
      <div class="st-head">
        <h1>SGTBL Standings <span>Fall 2026</span></h1>
        <div class="st-filters">
          <span class="st-pill" aria-current="true">Draft Division</span>
          <span class="st-select">Fall 2026 &middot; Regular Season</span>
        </div>
      </div>
      <div class="tabbar st-tabs" data-tabbar role="tablist">
        <button role="tab" aria-selected="true" aria-controls="p-st" id="t-st">Standings</button>
        <button role="tab" aria-selected="false" aria-controls="p-exp" id="t-exp">Expanded</button>
        <button role="tab" aria-selected="false" aria-controls="p-vs" id="t-vs">Vs. Division</button>
      </div>
      <div id="p-st" class="tabpanel" role="tabpanel" aria-labelledby="t-st">
        <h2 class="st-group">Draft Division</h2>
{table(h1, rows1, 'Draft Division standings')}
      </div>
      <div id="p-exp" class="tabpanel" role="tabpanel" aria-labelledby="t-exp" hidden>
        <h2 class="st-group">Draft Division &middot; Expanded</h2>
{table(h2, rows2, 'Expanded standings')}
      </div>
      <div id="p-vs" class="tabpanel" role="tabpanel" aria-labelledby="t-vs" hidden>
        <h2 class="st-group">Draft Division &middot; Head-to-head</h2>
{table(h3, rows3, 'Head-to-head records', sortable=False)}
        <p class="st-note">Each cell is the row team's record against the column team; &middot; = haven't played yet.</p>
      </div>
      <p class="st-note">Through {short(through)}. Teams are ranked by league points &mdash; <b>3 for a win, 1 for a tie, 0 for a loss</b>. Teams level on points are separated by point differential, then total points scored, then head-to-head, then a coin flip.{flip_note} The dashed line marks the playoff cutoff &mdash; the top {PLAYOFF_SPOTS} teams make the playoffs.{pend_note} Click a column heading to sort.</p>
      <div class="st-glossary">
        <h3>Glossary</h3>
        <dl>{''.join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in glossary)}</dl>
      </div>
      <p class="st-note">Results from <a href="https://uh.sportsvisio.com/league/texas-frisco/schedule" target="_blank" rel="noopener">Ultimate Hoops / SportsVisio</a> (Texas - Frisco, Draft Division).</p>
    </section>
  </div>
</main>
'''

CSS = '''<style>
/* Standings: pro-league standings page layout */
.st-wrap { padding-top: var(--space-6); padding-bottom: var(--space-8); }
.st-card { padding: var(--space-5) var(--space-5) var(--space-6); }
.st-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4); }
.st-head h1 { font-size: var(--text-3xl); }
.st-head h1 span { font-weight: 600; color: var(--text-muted); }
.st-filters { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.st-pill { padding: 6px 14px; border-radius: 999px; background: var(--brand); color: #fff; font-size: var(--text-sm); font-weight: 700; }
.st-select { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--border-strong); font-size: var(--text-sm); color: var(--text-primary); }
.st-tabs { margin-bottom: var(--space-4); }
.st-group { font-family: var(--font-body, inherit); font-size: var(--text-md); font-weight: 800; margin-bottom: var(--space-3); }
.st-scroll { overflow-x: auto; border-top: 1px solid var(--border); }
.st-table { width: 100%; min-width: 760px; border-collapse: separate; border-spacing: 0; font-size: var(--text-sm); }
.st-table th, .st-table td { padding: 10px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.st-table thead th { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; }
.st-table thead th[aria-sort] { cursor: pointer; user-select: none; }
.st-table thead th[aria-sort]:hover { color: var(--text-primary); }
.st-table thead th[aria-sort="descending"]::after { content: " \\25BE"; }
.st-table thead th[aria-sort="ascending"]::after { content: " \\25B4"; }
.st-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.st-table tbody tr:hover { background: var(--surface-alt); }
.st-table .st-ptscol { font-weight: 800; }
.st-table .st-sorted { background: color-mix(in srgb, var(--accent-blue) 8%, transparent); }
.st-team-h { text-align: left; position: sticky; left: 0; background: var(--surface); z-index: 1; }
.st-team { position: sticky; left: 0; z-index: 1; background: var(--surface); text-align: left; font-weight: 700; min-width: 190px; }
.st-table tbody tr:hover .st-team { background: var(--surface-alt); }
.st-team > * { vertical-align: middle; }
.st-rank { display: inline-block; width: 18px; color: var(--text-muted); font-weight: 600; font-size: var(--text-xs); }
.st-logo { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; margin-right: 10px; color: #fff; font-family: var(--font-display); font-size: 11px; font-weight: 800; }
.st-name a { color: var(--accent-blue); }
.st-abbr { display: none; }
.st-pos { color: var(--success); font-weight: 700; }
.st-formcell { text-align: left; }
.st-forms { display: inline-flex; gap: 4px; vertical-align: middle; }
.st-form { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; font-size: 12px; font-weight: 900; line-height: 1; cursor: default; }
.st-form-w { color: #fff; background: var(--success); }
.st-form-l { color: #fff; background: var(--danger); }
.st-form-t { color: #3d2c00; background: #f2c230; }
.st-neg { color: var(--danger); font-weight: 700; }
.st-next { text-align: left; }
tr.st-cut td, tr.st-cut th { border-bottom: 2px dashed var(--border-strong); }
.st-table.is-resorted tr.st-cut td, .st-table.is-resorted tr.st-cut th { border-bottom: 1px solid var(--border); }
.st-vs-code { display: block; margin-top: 2px; }
#p-vs .st-table thead th.num { text-align: center; }
#p-vs .st-table thead .st-logo { margin: 0 auto; }
#p-vs td.num { text-align: center; }
.st-self { text-align: center; color: var(--text-muted); background: var(--surface-alt); }
.st-none { color: var(--text-muted); }
.st-h2h-w { color: var(--success); font-weight: 800; }
.st-h2h-l { color: var(--danger); font-weight: 700; }
.st-note { font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-3); max-width: 90ch; }
.st-glossary { margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--border); }
.st-glossary h3 { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: .5px; margin-bottom: var(--space-3); }
.st-glossary dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px var(--space-5); margin: 0; }
.st-glossary dl div { display: flex; gap: 8px; font-size: var(--text-xs); }
.st-glossary dt { font-weight: 800; min-width: 62px; }
.st-glossary dd { margin: 0; color: var(--text-muted); }
@media (max-width: 640px) {
  .st-card { padding: var(--space-4) var(--space-3) var(--space-5); }
  .st-head h1 { font-size: var(--text-2xl); }
  .st-team { min-width: 0; }
  .st-name { display: none; }
  .st-abbr { display: inline; }
}
</style>'''

JS = '''<script>
// Standings: highlight the sorted column; hide the playoff line once rows are re-sorted
(function () {
  document.querySelectorAll(".st-table[data-sortable]").forEach(function (table) {
    function mark(idx) {
      table.querySelectorAll(".st-sorted").forEach(function (c) { c.classList.remove("st-sorted"); });
      if (idx < 1) return;
      table.querySelectorAll("tr").forEach(function (tr) { var c = tr.children[idx]; if (c) c.classList.add("st-sorted"); });
    }
    var heads = table.querySelectorAll("thead th");
    heads.forEach(function (h, i) { h.addEventListener("click", function () { if (!h.hasAttribute("aria-sort")) return; table.classList.add("is-resorted"); setTimeout(function () { mark(i); }, 0); }); });
    var pctIdx = Array.prototype.findIndex.call(heads, function (h) { return h.textContent === "PTS"; });
    if (pctIdx > 0) mark(pctIdx);
  });
})();
</script>'''

path = os.path.join(SITE, 'standings.html')
t = open(path, encoding='utf-8').read()
t = re.sub(r'(?s)\s*<style>.*?</style>', '', t, count=1)
t = t.replace('</head>', CSS + '\n</head>', 1)
t = re.sub(r'(?s)\n<main id="main">.*?</main>\n', main, t, count=1)
t = re.sub(r'(?s)\n<script>\n// Standings:.*?</script>', '', t)
t = re.sub(r'(<script src="assets/js/interactions\.js\?v=[0-9a-z]+"></script>)', lambda m: m.group(1) + '\n' + JS, t, count=1)
t = t.replace('<title>Standings — SGTBL</title>', '<title>Standings — SGTBL</title>', 1)
open(path, 'w', encoding='utf-8', newline='\n').write(t)
write_json()
print('standings.html:', ', '.join(f"{i + 1}. {x} {S[x]['w']}-{S[x]['l']}-{S[x]['t']} {S[x]['pts']} pts ({S[x]['pf'] - S[x]['pa']:+d})" for i, x in enumerate(order)))
