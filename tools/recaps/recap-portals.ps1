# Copies each public recap (game.html, game-oct22.html, game-oct29.html) into the Team Portal and League Admin,
# using the existing portal recap pages as the chrome (sidebar, top bar, persona).
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\site')).Path
$nl = "`r`n"
$files = 'game.html', 'game-oct22.html', 'game-oct29.html'
$portalCss = @'
/* portal: the nav sidebar takes ~260px, so stack the Gamecast sidebar, film room and score header sooner */
@media (max-width: 1240px) {
  .gc-layout { grid-template-columns: minmax(0, 1fr); }
  .fr { grid-template-columns: minmax(0, 1fr); }
  .fr-side { border-left: 0; border-top: 1px solid var(--border); height: auto; min-height: 0; max-height: 70vh; }
  .gc-head { padding: var(--space-4); gap: var(--space-3) var(--space-4); }
  .gc-team { flex-direction: column; align-items: center; text-align: center; gap: 6px; }
  .gc-home { flex-direction: column-reverse; }
  .gc-team-name, .gc-home .gc-team-name { text-align: center; align-items: center; }
  .gc-team-name a, .gc-team-name .gc-tn { font-size: var(--text-lg); }
  .gc-score, .gc-away .gc-score, .gc-home .gc-score { margin: 0; font-size: 2.6rem; }
}
'@
foreach ($portal in 'captain', 'admin') {
  $shell = [IO.File]::ReadAllText((Join-Path $root "$portal\game.html"))
  $isCap = $portal -eq 'captain'
  foreach ($file in $files) {
    $pub = [IO.File]::ReadAllText((Join-Path $root $file))
    $title = [regex]::Match($pub, '<title>(.*?) — SGTBL</title>').Groups[1].Value
    $style = [regex]::Match($pub, '(?s)<style>\r?\n(.*?)\r?\n</style>').Groups[1].Value + $nl + $portalCss.Replace("`r`n", "`n").Replace("`n", $nl).TrimEnd()
    $body = [regex]::Match($pub, '(?s)  <div class="wrap" style="padding-top:var\(--space-6\)">\r?\n(.*?)\r?\n  </div>\r?\n</main>').Groups[1].Value
    $script = [regex]::Match($pub, '(?s)<script>\r?\n// Game recap page script.*?</script>').Value
    if (-not $title -or -not $style -or -not $body -or -not $script) { throw "pieces not found in $file" }
    $b = $body.Replace('src="assets/img/', 'src="../assets/img/')
    $b = [regex]::Replace($b, '(?m)^    <p class="muted" style="font-size:var\(--text-sm\);margin-bottom:var\(--space-4\)"><a href="games.html" class="muted">Games</a> / .*?</p>', '    <p class="muted" style="font-size:var(--text-sm);margin-bottom:var(--space-4)"><a href="player.html" class="muted">Bryson Brown</a> / Game Recap</p>')
    $b = [regex]::Replace($b, '(?m)^    <h1 class="sr-only">.*?</h1>\r?\n', '')   # the portal top bar already has the page's h1
    if ($isCap) {
      $b = $b.Replace('<a href="team.html">Team Jeremy</a>', '<a href="my-team.html">Team Jeremy</a>')
      $b = $b.Replace('jumps the full film to that moment.</p>', 'jumps the full film to that moment. See <a href="film-room.html">Film Room</a> for the full team library.</p>')
    } else {
      $b = $b.Replace('<div class="gc-team-name"><a href="team.html">Team Jeremy</a>', '<div class="gc-team-name"><span class="gc-tn">Team Jeremy</span>')
      $b = $b.Replace('<a href="team.html">Team Jeremy</a>', 'Team Jeremy')   # admin has no team page
    }
    if ($b.Contains('href="team.html"') -or $b.Contains('href="games.html"')) { throw "public-only link left in $portal/$file" }
    $b = ($b -split "\r?\n" | ForEach-Object { if ($_) { '  ' + $_ } else { $_ } }) -join $nl
    $t = $shell
    $t = [regex]::Replace($t, '<title>.*? — Recap — ', ('<title>' + $title.Replace(' — Recap', '') + ' — Recap — ').Replace('$', '$$'))
    $m = [regex]::Match($t, '(?s)(    <div class="admin-content">\r?\n)(.*?)(\r?\n    </div>\r?\n  </div>\r?\n</div>\r?\n<script)')
    if (-not $m.Success) { throw "content not found in $portal shell" }
    $t = $t.Substring(0, $m.Groups[2].Index) + $b + $t.Substring($m.Groups[2].Index + $m.Groups[2].Length)
    $t = [regex]::Replace($t, '(?s)<style>.*?</style>', ('<style>' + $nl + $style + $nl + '</style>').Replace('$', '$$'))
    $t = [regex]::Replace($t, '(?s)\r?\n<script>\r?\n// (Highlight strip|Game recap page script).*?</script>', '')
    $t = [regex]::Replace($t, '(<script src="\.\./assets/js/interactions\.js\?v=[0-9a-z]+"></script>)', ('$1' + $nl + $script.Replace('$', '$$')))
    [IO.File]::WriteAllText((Join-Path $root "$portal\$file"), $t, (New-Object Text.UTF8Encoding $false))
    "$portal/$file : $title"
  }
}
