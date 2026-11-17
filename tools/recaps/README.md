# Game recap generator

Builds the Gamecast-style recap pages for Team Jeremy's games from real Ultimate Hoops / SportsVisio data.

- `games.json` - per game: SportsVisio game id, date/time, home/away, opponent (code, name, color token, record), final score, cameras, Four Factors, season series and the box score (copied from the SportsVisio game page).
- `events-fetch.ps1` - pulls every tagged event for each game from SportsVisio's public highlights feed, orders them on the film timeline, adds the running score, checks it against the box score, and writes `events-<key>.json`.
- `recap-page.js` - the page script (highlight strip, win probability / game flow chart, play-by-play, film room); reads the page's `#game-meta` and `#pbp-data` JSON.
- `recap-gen.ps1` - writes the public pages `site/game.html` (Nov 5), `site/game-oct22.html`, `site/game-oct29.html`, using the current `site/game.html` as the shell (head, nav, footer).
- `recap-portals.ps1` - copies them into `site/captain/` and `site/admin/` using the existing portal `game.html` pages as the chrome.

Run in Windows PowerShell from this folder: `.\events-fetch.ps1` (only to refresh data), then `.\recap-gen.ps1`, then `.\recap-portals.ps1`.