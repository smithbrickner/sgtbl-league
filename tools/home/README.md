# Homepage generator

Builds `site/index.html` (sports-network league homepage layout) from real Ultimate Hoops / SportsVisio data:

- `../recaps/schedule.json` - full Draft-division schedule and results (score strip, standings, headlines, "Up next").
  A game with `"status": "pending"` has film received but no score yet.
- `leaders.json` - top three per stat from the SportsVisio leaders table.
- `site/game*.html` - the generated recaps (lead story, story cards, headline links).
- `../recaps/events-*.json` - tagged plays with real clips (Top Plays).

The page's head, nav and footer are kept from the current `site/index.html`. To refresh after new results:
update `schedule.json` / `leaders.json`, then run `python tools/home/build_home.py` from the repo root.

League Leaders show a player's headshot when one is listed in `HEADSHOTS` in `build_home.py` (otherwise the team dot).
