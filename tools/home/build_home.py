"""Builds the public homepage (site/index.html) in the style of a pro-league sports homepage (score strip, lead story,
video highlights, story cards, top headlines, standings, leaders), using only real Ultimate Hoops / SportsVisio data:

  tools/recaps/schedule.json   full Draft-division schedule and results (home team first)
  tools/home/leaders.json      league leaders from SportsVisio
  site/game*.html              the generated game recaps (headline + lead paragraph + recap link)
  tools/recaps/events-*.json   tagged plays with real video clips (Top Plays)

The page's head, nav and footer are kept from the current site/index.html. Run:  python tools/home/build_home.py
"""
import html, json, os, re
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SITE = os.path.join(REPO, 'site')
RECAPS = os.path.join(REPO, 'tools', 'recaps')
TODAY = date(2026, 11, 20)   # the data snapshot this page was built from

TEAMS = {   # code, color token
    'Team Jeremy': ('TJ', 'var(--team-knicks-bg)'),
    'Team Martin': ('TM', 'var(--team-rams-bg)'),
    'Team Paul':   ('TP', 'var(--team-wolves-bg)'),
    'Team Turbo':  ('TT', 'var(--team-tigers-bg)'),
    'Team Evan':   ('TE', 'var(--team-eagles-bg)'),
}
BY_CODE = {v[0]: k for k, v in TEAMS.items()}
RECAP_FILES = {'2026-10-22': 'game-oct22.html', '2026-10-29': 'game-oct29.html', '2026-11-05': 'game.html'}   # Team Jeremy's games
CLIP = re.compile(r'^https://api\.sportsvisio-api\.com/media/[0-9a-f/-]+/clip\.mp4$')

def e(s): return html.escape(str(s), quote=True)
def d(iso): return date.fromisoformat(iso)
def md(iso): x = d(iso); return f"{x.month}/{x.day}"
def ap(iso):
    x = d(iso); m = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'][x.month - 1]
    return f"{x.strftime('%A')}, {m} {x.day}"
def short(iso): x = d(iso); return f"{x.strftime('%a')}, {x.strftime('%b')} {x.day}"
def crest(team, cls='hp-crest'):
    code, color = TEAMS[team]; return f'<span class="{cls}" style="background:{color}">{code}</span>'

schedule = json.load(open(os.path.join(RECAPS, 'schedule.json'), encoding='utf-8'))
leaders = json.load(open(os.path.join(HERE, 'leaders.json'), encoding='utf-8'))
played = [g for g in schedule if g.get('hs') is not None]
for g in schedule: g['final'] = g.get('hs') is not None

# ---------- standings: league points (W 3, T 1, L 0), then tiebreakers - shared with the standings page ----------
import sys
sys.path.insert(0, os.path.join(REPO, 'tools', 'standings'))
import standings_core as core
rec, table, any_ties, _flips = core.compute(schedule)
def diff(r): return core.diff(r)
def streak(r):
    if not r['res']: return '&ndash;'
    last = r['res'][-1]; n = 0
    for x in reversed(r['res']):
        if x != last: break
        n += 1
    return f"{last}{n}"

# ---------- recap headlines and leads, from the generated recap pages ----------
recaps = {}
for iso, f in RECAP_FILES.items():
    t = open(os.path.join(SITE, f), encoding='utf-8').read()
    m = re.search(r'<article class="card gc-card gc-story gc-article">\s*<h2>(.*?)</h2>\s*<p class="gc-dateline">.*?</p>\s*<p>(.*?)</p>', t, re.S)
    recaps[iso] = {'file': f, 'headline': m.group(1), 'lead': m.group(2)}

# ---------- clips from the recaps' event logs ----------
def events(key): return json.load(open(os.path.join(RECAPS, f'events-{key}.json'), encoding='utf-8'))
EV = {'2026-10-22': events('oct22'), '2026-10-29': events('oct29'), '2026-11-05': events('nov5')}
def find_clip(iso, player, pts, nth=1):
    hits = [x for x in EV[iso] if x['p'] == player and x['v'] == pts and x.get('src')]
    x = hits[min(nth, len(hits)) - 1]; assert CLIP.match(x['src']); return x
def thumb(src): return src[:-len('clip.mp4')] + 'clip.0000001.jpg'
def film(tc):
    h, m, s = tc.split(':')[:3]; return f"{int(h)}:{m}:{s}" if int(h) else f"{int(m)}:{s}"

# ---------- headline wording for results without a recap ----------
def result_line(g):
    hw = g['hs'] > g['as']; w, l = (g['home'], g['away']) if hw else (g['away'], g['home'])
    ws, ls = max(g['hs'], g['as']), min(g['hs'], g['as']); margin = ws - ls
    verb = 'routs' if margin >= 20 else 'edges' if margin <= 3 else 'beats'
    road = '' if hw else ' on the road'
    return f"{w} {verb} {l} {ws}-{ls}{road}"

# ================= page pieces =================
# score strip: every game, oldest to newest; the strip scrolls to the latest result on load
cards = []
for g in sorted(schedule, key=lambda g: (g['date'], g['time'])):
    status = 'Final' if g['final'] else ('Pending' if g.get('status') == 'pending' else g['time'])
    rows = []
    for team, sc, other in ((g['away'], g.get('as'), g.get('hs')), (g['home'], g.get('hs'), g.get('as'))):
        win = g['final'] and sc > other
        rows.append(f'<span class="hp-sc-row{" win" if win else ""}">{crest(team, "hp-dot")}<span class="hp-sc-team">{TEAMS[team][0]}</span><span class="hp-sc-pts">{sc if g["final"] else ""}</span></span>')
    link = RECAP_FILES.get(g['date']) if 'Team Jeremy' in (g['home'], g['away']) else None
    tag = 'a' if link else 'div'
    href = f' href="{link}"' if link else ''
    current = ' data-current' if g['final'] and not any(x['final'] and (x['date'], x['time']) > (g['date'], g['time']) for x in schedule) else ''
    cards.append(f'      <{tag} class="hp-sc{"" if g["final"] else " hp-sc-up"}"{href}{current}><span class="hp-sc-status">{short(g["date"])} &middot; {status}</span>{"".join(rows)}{"<span class=hp-sc-link>Recap</span>" if link else ""}</{tag}>')

# lead story: the most recent recap
lead_iso = max(recaps); L = recaps[lead_iso]
lead_clip = find_clip(lead_iso, 'Bryson Brown', 3, 5)
# Top Plays: real clips from the tagged event logs
plays = [
    ('2026-11-05', 'Bryson Brown', 3, 5, 'Bryson Brown buries his fifth 3-pointer in a 39-point night'),
    ('2026-10-22', 'Jeremy Jones', 3, 1, 'Jeremy Jones drills a 3 in the season opener'),
    ('2026-10-29', 'Champ Grayson', 2, 1, 'Champ Grayson scores inside for Team Paul'),
    ('2026-11-05', 'Evan Pastorelle', 3, 1, 'Evan Pastorelle connects from deep for Team Evan'),
]
play_cards = []
for iso, p, pts, nth, title in plays:
    x = find_clip(iso, p, pts, nth)
    play_cards.append(f'          <button type="button" class="hp-vid" data-src="{e(x["src"])}" data-title="{e(title)}"><span class="hp-vid-thumb"><img src="{e(thumb(x["src"]))}" alt="" loading="lazy"><i>0:07</i><b aria-hidden="true">&#9654;</b></span><span class="hp-vid-title">{e(title)}</span><span class="hp-vid-meta">{short(iso)} &middot; film {film(x["t"])}</span></button>')
# story cards: the other recaps, newest first
story_cards = []
for iso in sorted(recaps, reverse=True)[1:]:
    r = recaps[iso]; x = find_clip(iso, 'Bryson Brown', 3, 1)
    story_cards.append(f'''          <a class="card hp-story" href="{r["file"]}"><span class="hp-story-img"><img src="{e(thumb(x["src"]))}" alt="" loading="lazy"></span><span class="hp-story-body"><span class="hp-kicker">Recap &middot; {short(iso)}</span><b>{r["headline"]}</b><span class="hp-dek">{r["lead"]}</span></span></a>''')

# top headlines: every result, newest first (recaps link to their page)
heads = []
for g in sorted(played, key=lambda g: (g['date'], g['time']), reverse=True):
    if g['date'] in recaps and 'Team Jeremy' in (g['home'], g['away']):
        heads.append(f'            <li><a href="{recaps[g["date"]]["file"]}">{recaps[g["date"]]["headline"]}</a><span>{short(g["date"])} &middot; <a class="hp-hl-tag" href="{recaps[g["date"]]["file"]}">Recap &rsaquo;</a></span></li>')
    else:
        heads.append(f'            <li><span class="hp-hl-nolink">{e(result_line(g))}</span><span>{short(g["date"])}</span></li>')
pending = [g for g in schedule if g.get('status') == 'pending']
for g in pending:
    heads.insert(0, f'            <li><span class="hp-hl-nolink">{e(g["home"])} vs. {e(g["away"])}: film received, result pending</span><span>{short(g["date"])}</span></li>')

# standings rows
st_rows = []
for t in table:
    r = rec[t]; dv = diff(r); name = '<a href="team.html">Team Jeremy</a>' if t == 'Team Jeremy' else e(t)
    st_rows.append(f'              <tr{" class=hp-hi" if t == "Team Jeremy" else ""}><th scope="row">{crest(t, "hp-dot")}{name}</th><td class="num">{r["w"]}</td><td class="num">{r["l"]}</td><td class="num">{r["t"]}</td><td class="num hp-pts">{r["pts"]}</td><td class="num">{"+" if dv > 0 else "&minus;" if dv < 0 else ""}{abs(dv) + 1e-9:.1f}</td><td class="num">{streak(r)}</td></tr>')

# leaders
ld_blocks = []
for key, label in (('PPG', 'Points'), ('RPG', 'Rebounds'), ('APG', 'Assists')):
    items = []
    for i, (name, code, gp, val) in enumerate(leaders[key]):
        nm = f'<a href="player.html">{e(name)}</a>' if name == 'Bryson Brown' else e(name)
        items.append(f'<li><span class="hp-rank">{i + 1}</span>{crest(BY_CODE[code], "hp-dot")}<span class="hp-ld-name">{nm}<small>{e(BY_CODE[code])} &middot; {gp} GP</small></span><b>{val:.1f}</b></li>')
    ld_blocks.append(f'            <div class="hp-ld"><h4>{label} <span>per game</span></h4><ol>{"".join(items)}</ol></div>')

# Team Jeremy: next game
tj_next = [g for g in sorted(schedule, key=lambda g: (g['date'], g['time'])) if 'Team Jeremy' in (g['home'], g['away']) and not g['final']]
nxt = [g for g in tj_next if g.get('status') != 'pending'][0]
nxt_opp = nxt['away'] if nxt['home'] == 'Team Jeremy' else nxt['home']
nxt_where = 'vs.' if nxt['home'] == 'Team Jeremy' else '@'
pend_txt = ''
if pending:
    pg = pending[0]; po = pg['away'] if pg['home'] == 'Team Jeremy' else pg['home']
    pend_txt = f'<p class="hp-pending"><b>{short(pg["date"])} vs. {e(po)}:</b> film received by SportsVisio, result pending.</p>'

TJ = rec['Team Jeremy']
main = f'''  <section class="hp-scores" aria-label="Draft Division scores">
    <div class="hp-scores-inner">
      <span class="hp-scores-label">Draft<br>Fall 2026</span>
      <div class="hp-scores-strip" data-hp-strip>
{chr(10).join(cards)}
      </div>
    </div>
  </section>
'''
body = f'''
<main id="main" class="hp">
  <div class="wrap hp-wrap">
    <div class="hp-grid">
      <div class="hp-main">
        <article class="card hp-lead">
          <a class="hp-lead-img" href="{L["file"]}"><img src="{e(thumb(lead_clip["src"]))}" alt="Game film: Bryson Brown shoots a 3-pointer against Team Evan"><span class="hp-lead-tag">Recap</span></a>
          <div class="hp-lead-body">
            <span class="hp-kicker">{ap(lead_iso)} &middot; Draft Division</span>
            <h1><a href="{L["file"]}">{L["headline"]}</a></h1>
            <p>{L["lead"]}</p>
            <div class="hp-lead-actions"><a class="btn btn-accent btn-sm" href="{L["file"]}">Read the recap</a><button type="button" class="btn btn-outline btn-sm hp-vid-btn" data-src="{e(lead_clip["src"])}" data-title="Bryson Brown 3-pointer vs. Team Evan">&#9654; Watch the play</button></div>
          </div>
        </article>

        <section class="card hp-card" aria-labelledby="hp-plays-h">
          <div class="hp-card-head"><h2 id="hp-plays-h">Top Plays</h2><span class="hp-sub">Real game film from SportsVisio</span></div>
          <div class="hp-vids">
{chr(10).join(play_cards)}
          </div>
        </section>

        <div class="hp-stories">
{chr(10).join(story_cards)}
        </div>

        <a class="card hp-spot" href="player.html">
          <span class="hp-spot-img"><img src="assets/img/headshot-placeholder.webp" alt=""></span>
          <span class="hp-spot-body"><span class="hp-kicker">Player spotlight</span><b>Bryson Brown leads the league at {leaders["PPG"][0][3]:.1f} points per game</b>
            <span class="hp-dek">The Team Jeremy guard is shooting 51.6% from the field and 38.7% from 3-point range through three games, with a 39-point night at Team Evan.</span>
            <span class="hp-spot-stats"><span><b>30.3</b>PPG</span><span><b>7.7</b>RPG</span><span><b>4.7</b>APG</span><span><b>.516</b>FG%</span></span></span>
        </a>
      </div>

      <aside class="hp-rail">
        <section class="card hp-card" aria-labelledby="hp-hl-h">
          <div class="hp-card-head"><h2 id="hp-hl-h">Top Headlines</h2></div>
          <ul class="hp-headlines">
{chr(10).join(heads)}
          </ul>
        </section>

        <section class="card hp-card" aria-labelledby="hp-st-h">
          <div class="hp-card-head"><h2 id="hp-st-h">Standings</h2><span class="hp-sub">Draft Division</span></div>
          <table class="hp-standings">
            <thead><tr><th scope="col">Team</th><th scope="col" class="num">W</th><th scope="col" class="num">L</th><th scope="col" class="num">T</th><th scope="col" class="num" title="League points: 3 for a win, 1 for a tie">PTS</th><th scope="col" class="num" title="Average point differential per game">+/&minus;</th><th scope="col" class="num" title="Current streak">STRK</th></tr></thead>
            <tbody>
{chr(10).join(st_rows)}
            </tbody>
          </table>
          <p class="hp-note">Ranked by league points: 3 for a win, 1 for a tie. Level teams are split by point differential. Through {short(max(g["date"] for g in played))}.</p>
        </section>

        <section class="card hp-card" aria-labelledby="hp-ld-h">
          <div class="hp-card-head"><h2 id="hp-ld-h">League Leaders</h2><span class="hp-sub">2+ games</span></div>
{chr(10).join(ld_blocks)}
          <p class="hp-note">From the <a href="{e(leaders["source"])}" target="_blank" rel="noopener">SportsVisio leaders table</a>.</p>
        </section>

        <section class="card hp-card hp-next" aria-labelledby="hp-nx-h">
          <div class="hp-card-head"><h2 id="hp-nx-h">Team Jeremy</h2><span class="hp-sub">{core.rec(TJ, any_ties)} &middot; {TJ["pts"]} pts &middot; {streak(TJ)}</span></div>
          {pend_txt}
          <div class="hp-next-game">{crest("Team Jeremy")}<div><span class="hp-kicker">Next game</span><b>{nxt_where} {e(nxt_opp)}</b><span>{ap(nxt["date"])} &middot; {nxt["time"]}</span></div>{crest(nxt_opp)}</div>
          <div class="hp-next-links"><a href="team.html">Roster &amp; schedule</a><a href="player.html">Bryson Brown</a><a href="{L["file"]}">Latest recap</a></div>
        </section>

        <div class="hero-card hp-promo">
          <p class="eyebrow" style="color:var(--gold-400)">Registrations open</p>
          <h3 style="color:#fff;margin-top:6px">2026&ndash;27 season sign-ups are live</h3>
          <p style="color:rgba(255,255,255,.75);font-size:var(--text-sm);margin-top:6px">Open to any adult 18+. The season runs November through March &mdash; register early to be included in the tryout and auction draft.</p>
        </div>
      </aside>
    </div>
  </div>

  <dialog class="hp-dialog" data-hp-dialog aria-label="Video">
    <div class="hp-dialog-head"><b data-hp-dialog-title></b><button type="button" class="btn btn-ghost btn-sm" data-hp-close aria-label="Close video">&#10005;</button></div>
    <div class="hp-dialog-frame"><video controls playsinline data-hp-video></video></div>
  </dialog>
</main>
'''

CSS = '''<style>
/* Homepage: sports-network league page layout (score strip, lead story, rails) */
.hp-scores { background: var(--surface); border-bottom: 1px solid var(--border); }
.hp-scores-inner { display: flex; align-items: stretch; max-width: 1440px; margin: 0 auto; }
.hp-scores-label { flex: none; display: flex; align-items: center; padding: 0 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); border-right: 1px solid var(--border); line-height: 1.3; }
.hp-scores-strip { display: flex; overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
.hp-sc { flex: none; width: 150px; display: flex; flex-direction: column; gap: 3px; padding: 8px 12px; border-right: 1px solid var(--border); color: var(--text-primary); text-decoration: none; font-size: var(--text-xs); }
a.hp-sc:hover { background: var(--surface-alt); }
.hp-sc-status { font-weight: 700; color: var(--text-muted); font-size: 11px; }
.hp-sc-row { display: flex; align-items: center; gap: 6px; color: var(--text-muted); }
.hp-sc-row.win { color: var(--text-primary); font-weight: 800; }
.hp-sc-team { flex: 1; }
.hp-sc-pts { font-variant-numeric: tabular-nums; font-weight: 800; }
.hp-sc-up .hp-sc-row { color: var(--text-primary); }
.hp-sc-link { font-size: 11px; font-weight: 700; color: var(--accent-blue); }
.hp-dot { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; color: #fff; font-size: 0; flex: none; }
.hp-crest { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 15px; flex: none; }
.hp-wrap { padding-top: var(--space-5); padding-bottom: var(--space-8); }
.hp-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: var(--space-5); align-items: start; }
.hp-main, .hp-rail { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
.hp-card { padding: var(--space-4) var(--space-5) var(--space-5); }
.hp-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border); }
.hp-card-head h2 { font-family: var(--font-display); font-size: var(--text-lg); text-transform: uppercase; letter-spacing: .5px; }
.hp-sub { font-size: var(--text-xs); color: var(--text-muted); }
.hp-kicker { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--text-muted); }
.hp-note { font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-3); }
/* lead story */
.hp-lead { overflow: hidden; padding: 0; }
.hp-lead-img { position: relative; display: block; aspect-ratio: 16 / 8; background: #000; overflow: hidden; }
.hp-lead-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; }
.hp-lead-img:hover img { transform: scale(1.02); }
.hp-lead-tag { position: absolute; left: 16px; top: 16px; padding: 3px 10px; border-radius: 4px; background: var(--brand); color: #fff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
.hp-lead-body { padding: var(--space-5); }
.hp-lead h1 { font-size: clamp(1.6rem, 3vw, 2.3rem); line-height: 1.15; margin: 6px 0 var(--space-3); }
.hp-lead h1 a { color: var(--text-primary); text-decoration: none; }
.hp-lead h1 a:hover { text-decoration: underline; }
.hp-lead-body p { color: var(--text-muted); font-size: var(--text-base); line-height: 1.6; max-width: 70ch; }
.hp-lead-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-4); }
/* top plays */
.hp-vids { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); }
.hp-vid { display: flex; flex-direction: column; gap: 6px; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.hp-vid-thumb { position: relative; display: block; aspect-ratio: 16 / 9; border-radius: var(--radius-md); overflow: hidden; background: #000; }
.hp-vid-thumb img { width: 100%; height: 100%; object-fit: cover; }
.hp-vid-thumb i { position: absolute; left: 6px; bottom: 6px; padding: 1px 6px; border-radius: 3px; background: rgba(0,0,0,.75); color: #fff; font-style: normal; font-size: 11px; font-weight: 700; }
.hp-vid-thumb b { position: absolute; inset: 0; margin: auto; width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.hp-vid:hover .hp-vid-title, .hp-vid:focus-visible .hp-vid-title { text-decoration: underline; }
.hp-vid-title { font-size: var(--text-sm); font-weight: 700; line-height: 1.3; }
.hp-vid-meta { font-size: 11px; color: var(--text-muted); }
/* story cards */
.hp-stories { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); }
.hp-story { display: flex; flex-direction: column; overflow: hidden; padding: 0; color: var(--text-primary); text-decoration: none; }
.hp-story-img { display: block; aspect-ratio: 16 / 9; background: #000; overflow: hidden; }
.hp-story-img img { width: 100%; height: 100%; object-fit: cover; }
.hp-story-body { display: flex; flex-direction: column; gap: 6px; padding: var(--space-4); }
.hp-story-body b, .hp-spot-body b { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.15; }
.hp-story:hover b, .hp-spot:hover b { text-decoration: underline; }
.hp-dek { font-size: var(--text-sm); color: var(--text-muted); line-height: 1.5; }
/* player spotlight */
.hp-spot { display: grid; grid-template-columns: 170px minmax(0, 1fr); align-items: center; overflow: hidden; padding: 0; color: var(--text-primary); text-decoration: none; }
.hp-spot-img { align-self: stretch; display: flex; align-items: flex-end; justify-content: center; background: linear-gradient(160deg, var(--team-knicks-bg), var(--navy-900)); }
.hp-spot-img img { width: 100%; max-width: 170px; display: block; }
.hp-spot-body { display: flex; flex-direction: column; gap: 6px; padding: var(--space-4) var(--space-5); }
.hp-spot-stats { display: flex; gap: var(--space-4); margin-top: 4px; }
.hp-spot-stats span { display: flex; flex-direction: column; font-size: 11px; font-weight: 700; color: var(--text-muted); }
.hp-spot-stats span b { font-size: var(--text-xl); color: var(--text-primary); }
/* rail */
.hp-headlines { list-style: none; margin: 0; padding: 0; }
.hp-headlines li { display: flex; flex-direction: column; gap: 2px; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm); line-height: 1.35; }
.hp-headlines li:last-child { border-bottom: 0; }
.hp-headlines a { color: var(--text-primary); font-weight: 600; text-decoration: none; }
.hp-headlines a:hover { text-decoration: underline; color: var(--accent-blue); }
.hp-hl-nolink { font-weight: 600; }
.hp-headlines a.hp-hl-tag { color: var(--accent-blue); font-weight: 700; font-size: 11px; }
.hp-headlines li > span:last-child { font-size: 11px; color: var(--text-muted); }
.hp-standings { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.hp-standings th, .hp-standings td { padding: 7px 3px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
.hp-standings .num { text-align: right; font-variant-numeric: tabular-nums; }
.hp-standings thead th { font-size: 11px; color: var(--text-muted); font-weight: 700; }
.hp-standings tbody th { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.hp-standings tbody th a { color: var(--accent-blue); }
.hp-standings tr.hp-hi { background: var(--surface-alt); }
.hp-standings .hp-pts { font-weight: 800; }
.hp-ld + .hp-ld { margin-top: var(--space-3); }
.hp-ld h4 { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
.hp-ld h4 span { font-weight: 500; color: var(--text-muted); text-transform: none; letter-spacing: 0; }
.hp-ld ol { list-style: none; margin: 0; padding: 0; }
.hp-ld li { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm); }
.hp-ld li:last-child { border-bottom: 0; }
.hp-rank { width: 14px; color: var(--text-muted); font-weight: 700; font-size: var(--text-xs); }
.hp-ld-name { flex: 1; display: flex; flex-direction: column; font-weight: 600; line-height: 1.2; }
.hp-ld-name a { color: var(--accent-blue); }
.hp-ld-name small { font-size: 11px; color: var(--text-muted); font-weight: 500; }
.hp-ld li b { font-variant-numeric: tabular-nums; }
.hp-pending { font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-3); }
.hp-next-game { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); text-align: center; }
.hp-next-game > div { display: flex; flex-direction: column; gap: 2px; }
.hp-next-game > div span { font-size: var(--text-xs); color: var(--text-muted); }
.hp-next-links { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border); font-size: var(--text-sm); font-weight: 600; }
.hp-next-links a { color: var(--accent-blue); }
.hp-promo { padding: var(--space-5); }
/* video pop-up */
.hp-dialog { width: min(920px, 94vw); padding: 0; border: 0; border-radius: var(--radius-lg); background: #000; color: #fff; }
.hp-dialog::backdrop { background: rgba(0,0,0,.7); }
.hp-dialog-head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: 8px 8px 8px 16px; font-size: var(--text-sm); }
.hp-dialog-head .btn { color: #fff; }
.hp-dialog-frame { aspect-ratio: 16 / 9; }
.hp-dialog-frame video { width: 100%; height: 100%; display: block; background: #000; }
@media (max-width: 1080px) { .hp-grid { grid-template-columns: minmax(0, 1fr); } .hp-rail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } }
@media (max-width: 760px) { .hp-vids { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hp-stories { grid-template-columns: minmax(0, 1fr); } .hp-rail { display: flex; } .hp-spot { grid-template-columns: 110px minmax(0, 1fr); } .hp-spot-stats { gap: var(--space-3); } .hp-lead-img { aspect-ratio: 16 / 10; } }
</style>'''

JS = '''<script>
// Homepage: score strip starts at the latest result; Top Plays open their clip in a pop-up player
(function () {
  var strip = document.querySelector("[data-hp-strip]"), cur = strip && strip.querySelector("[data-current]");
  if (cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + cur.offsetWidth);
  var dlg = document.querySelector("[data-hp-dialog]"), v = dlg && dlg.querySelector("[data-hp-video]");
  var CLIP = /^https:\\/\\/api\\.sportsvisio-api\\.com\\/media\\/[0-9a-f\\/-]+\\/clip\\.mp4$/;
  document.querySelectorAll(".hp-vid, .hp-vid-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var src = b.getAttribute("data-src"); if (!dlg || !CLIP.test(src)) return;
      dlg.querySelector("[data-hp-dialog-title]").textContent = b.getAttribute("data-title");
      v.src = src; if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); v.play().catch(function () {});
    });
  });
  function close() { if (!v) return; v.pause(); v.removeAttribute("src"); v.load(); if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
  if (dlg) { dlg.querySelector("[data-hp-close]").addEventListener("click", close); dlg.addEventListener("cancel", function () { v.pause(); }); dlg.addEventListener("click", function (ev) { if (ev.target === dlg) close(); }); }
})();
</script>'''

# ---------- assemble from the current page's head, nav and footer ----------
path = os.path.join(SITE, 'index.html')
t = open(path, encoding='utf-8').read()
t = re.sub(r'(?s)\s*<style>.*?</style>', '', t, count=1)                       # previous generated CSS
t = t.replace('</head>', CSS + '\n</head>', 1)
t = re.sub(r'(?s)<div class="ticker".*?</div>\s*</div>\s*</div>\s*', '', t, count=1)     # old placeholder ticker
t = re.sub(r'(?s)\s*<section class="hp-scores".*?</section>\s*', '\n', t, count=1)      # previous score strip
t = t.replace('<a class="skip-link" href="#main">Skip to content</a>\n', '<a class="skip-link" href="#main">Skip to content</a>\n\n' + main, 1)
t = re.sub(r'(?s)\n<main id="main".*?</main>\n', body, t, count=1)
t = re.sub(r'(?s)\n<script>\n// Homepage:.*?</script>', '', t)
t = re.sub(r'(<script src="assets/js/interactions\.js\?v=[0-9a-z]+"></script>)', lambda m: m.group(1) + '\n' + JS, t, count=1)
t = t.replace('<title>SGTBL — Smithtown Gospel Tabernacle Basketball League</title>', '<title>SGTBL — Smithtown Gospel Tabernacle Basketball League</title>', 1)
open(path, 'w', encoding='utf-8', newline='\n').write(t)
print(f"index.html: {len(cards)} score cards, lead = {L['headline']!r}, {len(play_cards)} plays, {len(story_cards)} story cards, {len(heads)} headlines")
print('standings:', ', '.join(f"{t} {rec[t]['w']}-{rec[t]['l']}-{rec[t]['t']} {rec[t]['pts']} pts {diff(rec[t]):+.1f}" for t in table))
