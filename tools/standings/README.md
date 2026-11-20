# Standings generator

Builds `site/standings.html` (pro-league standings layout) with a **season dropdown**: every season of the
Ultimate Hoops Texas - Frisco league, each with Standings / Expanded / Vs. League views, sortable columns and a
glossary. The selected season is in the address (`standings.html?season=summer-2025`).

- `fetch_seasons.py` - pulls every season's schedule and results from SportsVisio's public schedule pages into
  `seasons.json` (18 seasons, Summer 2022 - Fall 2026; one division per season so far - Draft for Fall 2026,
  Open before that - and it fetches each division separately if a season ever has more than one).
- `standings_core.py` - the rules: league points (win 3, tie 1, loss 0), then point differential, total points
  scored, head-to-head among teams still level, then a coin flip. Also used by the homepage.
- `build_standings.py` - writes the page. The current season (Fall 2026) comes from `../recaps/schedule.json`
  (shared with the homepage and recaps; playoff line after 3rd, pending-game note, games left / next game);
  past seasons come from `seasons.json` as final standings (no playoff line - SportsVisio doesn't mark playoff
  games, so every listed game counts; listed games that never got a score are left out and noted). Also writes
  `standings.json`, which the recap generator reads for its sidebar.

To refresh: `python tools/standings/fetch_seasons.py` (past seasons), update `../recaps/schedule.json` for the
current season, then `python tools/standings/build_standings.py`, `python tools/home/build_home.py` and the
recap scripts in `tools/recaps/`. Run from the repo root.
