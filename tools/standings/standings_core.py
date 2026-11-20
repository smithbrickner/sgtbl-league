"""League standings rules, shared by the standings page, the homepage and (via standings.json) the game recaps.

League points: win = 3, tie = 1, loss = 0. Teams are ranked by points, then the league tiebreakers in order:
point differential, total points scored, head-to-head points among the teams still tied, then a coin flip
(not decidable from data - such teams keep alphabetical order and the page says so).
"""
import json, os
from functools import cmp_to_key

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SCHEDULE = os.path.join(REPO, 'tools', 'recaps', 'schedule.json')
WIN, TIE, LOSS = 3, 1, 0

TEAMS = {   # code, color token
    'Team Jeremy': ('TJ', 'var(--team-knicks-bg)'),
    'Team Martin': ('TM', 'var(--team-rams-bg)'),
    'Team Paul':   ('TP', 'var(--team-wolves-bg)'),
    'Team Turbo':  ('TT', 'var(--team-tigers-bg)'),
    'Team Evan':   ('TE', 'var(--team-eagles-bg)'),
}

def load_schedule():
    games = json.load(open(SCHEDULE, encoding='utf-8'))
    return sorted(games, key=lambda g: (g['date'], g['time']))

def blank():
    return {'w': 0, 'l': 0, 't': 0, 'pts': 0, 'pf': 0, 'pa': 0, 'home': [0, 0, 0], 'away': [0, 0, 0], 'res': [], 'h2h': {}, 'games': []}

def compute(games=None):
    """Returns (records by team, ranked team list, any_ties, coin_flip_groups)."""
    games = games if games is not None else load_schedule()
    S = {t: blank() for t in TEAMS}
    for g in games:
        if g.get('hs') is None: continue
        for team, opp, us, them, home in ((g['home'], g['away'], g['hs'], g['as'], True), (g['away'], g['home'], g['as'], g['hs'], False)):
            r = S[team]; k = 0 if us > them else 1 if us < them else 2      # 0 win, 1 loss, 2 tie
            r['pf'] += us; r['pa'] += them
            r[('w', 'l', 't')[k]] += 1; r['pts'] += (WIN, LOSS, TIE)[k]
            r['res'].append('WLT'[k]); (r['home'] if home else r['away'])[k] += 1
            h = r['h2h'].setdefault(opp, [0, 0, 0]); h[k] += 1
            r['games'].append({'date': g['date'], 'opp': opp, 'us': us, 'them': them, 'k': k, 'home': home})
    any_ties = any(r['t'] for r in S.values())

    def key(t): r = S[t]; return (r['pts'], r['pf'] - r['pa'], r['pf'])
    order = sorted(TEAMS, key=lambda t: (tuple(-x for x in key(t)), t))
    # head-to-head among teams still level on points, differential and points scored
    ranked, i, flips = [], 0, []
    while i < len(order):
        j = i
        while j + 1 < len(order) and key(order[j + 1]) == key(order[i]): j += 1
        group = order[i:j + 1]
        if len(group) > 1:
            def h2h_pts(t): return sum(WIN * S[t]['h2h'].get(o, [0, 0, 0])[0] + TIE * S[t]['h2h'].get(o, [0, 0, 0])[2] for o in group if o != t)
            group = sorted(group, key=lambda t: (-h2h_pts(t), t))
            vals = [h2h_pts(t) for t in group]
            if len(set(vals)) < len(vals): flips.append([t for t in group if vals.count(h2h_pts(t)) > 1])
        ranked += group; i = j + 1
    return S, ranked, any_ties, flips

def gp(r): return r['w'] + r['l'] + r['t']
def rec(r, any_ties): return f"{r['w']}-{r['l']}" + (f"-{r['t']}" if any_ties else '')
def split_txt(wlt, any_ties): return f"{wlt[0]}-{wlt[1]}" + (f"-{wlt[2]}" if any_ties else '')
def split_pts(wlt): n = sum(wlt); return (WIN * wlt[0] + TIE * wlt[2]) / (WIN * n) if n else -1   # share of available points, for sorting
def diff(r): return (r['pf'] - r['pa']) / gp(r) if gp(r) else 0
def streak(r):
    if not r['res']: return '&ndash;', 0
    last = r['res'][-1]; n = 0
    for x in reversed(r['res']):
        if x != last: break
        n += 1
    return f"{last}{n}", (n if last == 'W' else -n if last == 'L' else 0)

def write_json(path=os.path.join(HERE, 'standings.json')):
    """Ranked table for the PowerShell recap generator."""
    S, order, any_ties, flips = compute()
    rows = [{'team': t, 'code': TEAMS[t][0], 'w': S[t]['w'], 'l': S[t]['l'], 't': S[t]['t'], 'pts': S[t]['pts'],
             'diff': (1 if diff(S[t]) >= 0 else -1) * round(abs(diff(S[t])) + 1e-9, 1)} for t in order]   # round half away from zero
    played = [g['date'] for g in load_schedule() if g.get('hs') is not None]
    json.dump({'through': max(played), 'rule': 'W 3, T 1, L 0; then point differential, points scored, head-to-head', 'rows': rows},
              open(path, 'w', encoding='utf-8', newline='\n'), indent=1)
    return path
