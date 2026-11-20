"""Pulls every season's schedule and results for the Ultimate Hoops Texas - Frisco league from SportsVisio's public
schedule pages and writes tools/standings/seasons.json:

  [{"name": "Summer 2026", "eventId": "...", "divisions": [{"name": "Open", "id": "...", "games": [
      {"date": "2026-09-17", "time": "9:00 PM", "home": "Ball is Life", "away": "The Board Room", "hs": 81, "as": 60,
       "status": "Final", "gameId": "..."}, ...]}]}, ...]

SportsVisio lists the home team first and the score home-away. Games without a final score have no hs/as.
Run from the repo root:  python tools/standings/fetch_seasons.py
"""
import html, json, os, re, time, urllib.request
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = 'https://uh.sportsvisio.com/league/texas-frisco/schedule'
UA = {'User-Agent': 'Mozilla/5.0 (league standings fetch)'}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode('utf-8')

def text(s): return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()

def parse_rows(page):
    games = []
    for row in re.findall(r'(?s)<tr class="table-row-hover".*?</tr>', page):
        tds = re.findall(r'(?s)<td[^>]*>(.*?)</td>', row)
        if len(tds) < 4: continue
        when = text(tds[0])                                   # "Sep 17, 2026 · 9:00 PM"
        m = re.search(r'(?s)hidden md:inline[^"]*"><span[^>]*>(.*?)</span>\s*<span[^>]*>vs</span>\s*<span[^>]*>(.*?)</span>', tds[1])
        if not m: continue
        home, away = text(m.group(1)), text(m.group(2))
        d, _, t = when.partition('·')
        g = {'date': datetime.strptime(d.strip(), '%b %d, %Y').strftime('%Y-%m-%d'), 'time': t.strip(), 'home': home, 'away': away}
        status = re.sub(r'\s*▶\s*Watch', '', text(tds[3])).strip()
        sc = re.match(r'(\d+)\s*[–-]\s*(\d+)', text(tds[2]))
        if status == 'Final' and sc: g['hs'], g['as'] = int(sc.group(1)), int(sc.group(2))
        g['status'] = status
        gid = re.search(r'/game/([0-9a-f-]{36})', row)
        if gid: g['gameId'] = gid.group(1)
        games.append(g)
    return sorted(games, key=lambda g: (g['date'], datetime.strptime(g['time'], '%I:%M %p') if g['time'] else 0))

def main():
    first = get(BASE).replace('\\"', '"')
    i = first.find('"events":[{')
    events = json.loads(first[i + 9:first.index('}]', i) + 2])
    seasons = []
    for ev in events:
        page = get(f"{BASE}?eventId={ev['id']}")
        flat = page.replace('\\"', '"')
        pills = re.findall(r'gradient-pill[^"]*">([^<]+)</button>', page)
        divs = []
        for name in pills:
            m = re.search(r'\{"id":"([0-9a-f-]{36})","name":"' + re.escape(name) + '"', flat)
            divs.append({'name': name, 'id': m.group(1) if m else None})
        if len(divs) <= 1:
            d = divs[0] if divs else {'name': 'League', 'id': None}
            d['games'] = parse_rows(page); divs = [d]
        else:   # more than one division: the table shows one at a time
            for d in divs:
                d['games'] = parse_rows(get(f"{BASE}?eventId={ev['id']}&divisionId={d['id']}"))
                time.sleep(0.3)
        seasons.append({'name': ev['name'], 'eventId': ev['id'], 'divisions': divs})
        print(f"{ev['name']:12} " + ', '.join(f"{d['name']}: {len(d['games'])} games ({sum(1 for g in d['games'] if 'hs' in g)} final), {len({x for g in d['games'] for x in (g['home'], g['away'])})} teams" for d in divs))
        time.sleep(0.3)
    out = os.path.join(HERE, 'seasons.json')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('[\n' + ',\n'.join(json.dumps(s, ensure_ascii=False) for s in seasons) + '\n]\n')
    print('wrote', out)

if __name__ == '__main__':
    main()
