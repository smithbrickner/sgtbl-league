# For each game in games.json: fetch every tagged event (all players), order on the film timeline, add the running score,
# and check it against the box score. Writes events-<key>.json.
$ErrorActionPreference = 'Stop'
$games = Get-Content (Join-Path $PSScriptRoot 'games.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($g in $games) {
  $who = @{}; $boxPts = @{}
  foreach ($side in 'TJ', 'OPP') {
    foreach ($r in $g.box.$side) {
      $code = if ($side -eq 'TJ') { 'TJ' } else { $g.opp.code }
      $name = $r[0] -replace ' \(2nd listing\)$', ''
      $who[$r[1]] = @($code, $name)
      $boxPts[$r[1]] = [int]$boxPts[$r[1]] + [int]$r[2]
    }
  }
  $seen = @{}
  foreach ($id in $who.Keys) {
    $j = (Invoke-WebRequest -UseBasicParsing "https://uh.sportsvisio.com/api/highlights/player/${id}?games=$($g.gameId)").Content | ConvertFrom-Json
    foreach ($e in @($j.games.($g.gameId).events)) { if ($e -and -not $seen.ContainsKey($e.id)) { $seen[$e.id] = $e } }
  }
  $tj = 0; $op = 0; $pts = @{}; $out = @()
  foreach ($e in ($seen.Values | Sort-Object startTime)) {
    if (-not $who.ContainsKey($e.actorPlayerId)) { throw "$($g.key): unknown actor $($e.actorPlayerId)" }
    if ($e.clipUrl -notmatch '^https://api\.sportsvisio-api\.com/media/[0-9a-f/-]+/clip\.mp4$') { throw "bad clip url" }
    $w = $who[$e.actorPlayerId]; $q = @($e.qualifiers); $made = $q -contains 'made'
    $v = if ($e.action -eq 'shooting' -and $made) { if ($q -contains '3-point') { 3 } elseif ($q -contains '1-point') { 1 } else { 2 } } else { 0 }
    if ($v) { if ($w[0] -eq 'TJ') { $tj += $v } else { $op += $v }; $pts[$e.actorPlayerId] = $v + [int]$pts[$e.actorPlayerId] }
    $d = switch ($e.action) {
      'shooting' { $s = if ($q -contains '3-point') { '3-pointer' } elseif ($q -contains '1-point') { 'free throw' } else { '2-point shot' }; $(if ($made) { 'makes ' } else { 'misses ' }) + $s }
      'rebound'  { $(if ($q -contains 'offensive') { 'offensive' } else { 'defensive' }) + ' rebound' }
      'assist-2' { 'assist' }
      default    { $e.action }
    }
    $out += '{"t":"' + $e.startTime + '","tm":"' + $w[0] + '","p":"' + $w[1] + '","d":"' + $d + '","v":' + $v + ',"s":[' + $tj + ',' + $op + '],"src":"' + $e.clipUrl + '"}'
  }
  $note = ''
  if ($tj -ne $g.score[0] -or $op -ne $g.score[1]) { $note += " FINAL MISMATCH $tj-$op vs $($g.score[0])-$($g.score[1])" }
  foreach ($id in $boxPts.Keys) { if ([int]$pts[$id] -ne $boxPts[$id]) { $note += " | $($who[$id][1]) $([int]$pts[$id]) vs box $($boxPts[$id])" } }
  [IO.File]::WriteAllText((Join-Path $PSScriptRoot "events-$($g.key).json"), ('[' + ($out -join ",`n") + ']'), (New-Object Text.UTF8Encoding $false))
  $cams = ($seen.Values | ForEach-Object { $_.clipUrl.Split('/')[5].Substring(0, 8) } | Group-Object | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ' '
  "$($g.key): $($out.Count) events, $(@($out | Where-Object { $_ -notmatch '"v":0' }).Count) scoring, replay $tj-$op, cams $cams$(if ($note) { ' ::' + $note } else { ' - all players match the box' })"
}
