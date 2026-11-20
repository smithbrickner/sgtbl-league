# Standings generator

Builds `site/standings.html` (pro-league standings layout: Standings / Expanded / Vs. Division views, sortable
columns, glossary) from `../recaps/schedule.json` - the real Draft-division schedule and results.
Order: league points (win 3, tie 1, loss 0), then the league tiebreakers: point differential, total points scored,
head-to-head among teams still level, then a coin flip. The rules are in `standings_core.py`, which the homepage also
uses; `build_standings.py` also writes `standings.json`, which the recap generator reads for its sidebar. The dashed line marks the
playoff cutoff (top 3). The page's head, nav and footer are kept from the current `site/standings.html`.

To refresh after new results: update `schedule.json`, then run `python tools/standings/build_standings.py`
from the repo root, then `python tools/home/build_home.py` (homepage) and the recap scripts in `tools/recaps/`
(their sidebars read `standings.json`).
