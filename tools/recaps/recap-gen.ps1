# Generates the Gamecast-style recap for each of Team Jeremy's games (public site) from games.json + events-<key>.json.
# Run recap-portals.ps1 afterwards to copy them into the Team Portal and League Admin.
$ErrorActionPreference = 'Stop'
$ic = [Globalization.CultureInfo]::InvariantCulture
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\site')).Path
$nl = "`r`n"
function N($s) { $s.Replace("`r`n", "`n").Replace("`n", $nl) }
function HtmlE($s) { [System.Net.WebUtility]::HtmlEncode([string]$s) }
function F1($x) { ([Math]::Round([double]$x, 1, [MidpointRounding]::AwayFromZero)).ToString('0.0', $ic) }
function BR($m, $a) { if (-not $a) { return '' }; $s = ([Math]::Round([double]$m / $a, 3, [MidpointRounding]::AwayFromZero)).ToString('0.000', $ic); if ($s.StartsWith('0')) { $s.Substring(1) } else { $s } }
function MA($s) { $a = $s.Split('-'); @([int]$a[0], [int]$a[1]) }
function Clock($sec) { $sec = [int]$sec; $h = [Math]::Floor($sec / 3600); $m = [Math]::Floor(($sec % 3600) / 60); $s = $sec % 60; if ($h) { "{0}:{1:00}:{2:00}" -f $h, $m, $s } else { "{0}:{1:00}" -f $m, $s } }
function FilmT($tc) { $p = $tc.Split(':'); if ([int]$p[0]) { [int]$p[0] + ':' + $p[1] + ':' + $p[2] } else { [string][int]$p[1] + ':' + $p[2] } }
function Last($n) { if ($n -match '^Player #') { $n } else { ($n -split ' ')[-1] } }
function Init($n) { if ($n -match '^Player #(\d+)') { $Matches[1] } else { (($n -replace ' \(.*\)$', '') -split ' ' | ForEach-Object { $_.Substring(0, 1).ToUpper() }) -join '' } }

$games = Get-Content (Join-Path $PSScriptRoot 'games.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$camLen = @{ 'oct22' = 3324; 'oct29' = 3762; 'nov5' = 3979 }
$TJ = @{ code = 'TJ'; name = 'Team Jeremy'; color = 'var(--team-knicks-bg)'; record = '2-1' }
$baseCss = [regex]::Match([IO.File]::ReadAllText((Join-Path $root 'game.html')), '(?s)<style>\r?\n(.*?)\r?\n</style>').Groups[1].Value
$cut = $baseCss.IndexOf("/* Team Jeremy's games strip"); if ($cut -ge 0) { $baseCss = $baseCss.Substring(0, $cut).TrimEnd() }   # the generator's own additions get re-appended below
$pageJs = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'recap-page.js')).Trim()
$shell = [IO.File]::ReadAllText((Join-Path $root 'game.html'))   # nav, footer and head come from the current public recap

$extraCss = @'
/* Team Jeremy's games strip (top of every recap) */
.gstrip { display: flex; gap: var(--space-2); overflow-x: auto; margin-bottom: var(--space-4); padding-bottom: 2px; }
.gstrip > a, .gstrip > span { flex: none; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); color: var(--text-primary); font-size: var(--text-xs); text-decoration: none; min-width: 132px; }
.gstrip > a:hover { border-color: var(--accent-blue); }
.gstrip [aria-current="page"] { border-color: var(--brand); box-shadow: inset 0 -3px 0 var(--brand); }
.gstrip b { font-size: var(--text-sm); }
.gstrip .gs-w { color: var(--success); font-weight: 800; }
.gstrip .gs-l { color: var(--danger); font-weight: 800; }
.gstrip .gs-next { color: var(--text-muted); border-style: dashed; }
/* Film room camera switch */
.fr-cams { display: inline-flex; gap: 6px; margin-left: var(--space-3); }
.fr-cams button { padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border-strong); background: none; color: var(--text-muted); font: inherit; font-size: var(--text-xs); font-weight: 700; cursor: pointer; }
.fr-cams button[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: #fff; }
.pbp-row.pbp-note { color: var(--text-muted); font-style: italic; }
.gc-home .gc-winner::before { content: "\25B8"; font-size: .5em; vertical-align: middle; margin-right: 6px; }
/* Shot chart (placeholder locations) */
.sc-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: var(--surface-alt); border: 1px solid var(--border-strong); color: var(--text-muted); font-family: var(--font-body, inherit); font-size: 10px; font-weight: 700; letter-spacing: .3px; vertical-align: middle; text-transform: uppercase; }
.sc-filters { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
.sc-select { width: auto; padding-top: 4px; padding-bottom: 4px; font-size: var(--text-xs); }
.sc-court svg { display: block; width: 100%; height: auto; }
.sc-court .court { fill: var(--surface-alt); stroke: var(--border-strong); stroke-width: 2; }
.sc-court .ln { fill: none; stroke: var(--border-strong); stroke-width: 2; }
.sc-court .shot { cursor: default; }
.sc-court .shot.has-film { cursor: pointer; }
.sc-court .shot.dim { opacity: .12; }
.sc-court .shot.hot circle.ring { stroke: var(--text-primary); stroke-width: 3; }
.gc-note { font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-2); }
'@
$css = $baseCss.TrimEnd() + $nl + (N $extraCss).TrimEnd()
# drop rules that hard-code the Nov 5 team colors; each page sets its own inline
$css = [regex]::Replace($css, '\r?\n  background: linear-gradient\(90deg, color-mix\(in srgb, var\(--team-knicks-bg\).*?\);', '')
$css = $css.Replace('.gc-hl-full { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--team-knicks-bg), var(--team-eagles-bg));', '.gc-hl-full { display: flex; align-items: center; justify-content: center;')
$css = $css.Replace('.gc-bar-a { background: var(--team-knicks-bg); }', '.gc-bar-a { background: var(--gc-a); }').Replace('.gc-bar-b { background: var(--team-eagles-bg); }', '.gc-bar-b { background: var(--gc-b); }')
$css = $css.Replace('.fr-thumb.fr-full { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--team-knicks-bg), var(--team-eagles-bg));', '.fr-thumb.fr-full { display: flex; align-items: center; justify-content: center;')

# the strip of Team Jeremy's games (same on every recap)
$stripGames = @(
  @{ key = 'oct22'; file = 'game-oct22.html'; date = 'Oct 22'; opp = 'vs Team Turbo'; res = 'W'; score = '94-60' },
  @{ key = 'oct29'; file = 'game-oct29.html'; date = 'Oct 29'; opp = '@ Team Paul'; res = 'L'; score = '64-71' },
  @{ key = 'nov5'; file = 'game.html'; date = 'Nov 5'; opp = '@ Team Evan'; res = 'W'; score = '100-88' })

foreach ($g in $games) {
  $O = @{ code = $g.opp.code; name = $g.opp.name; color = $g.opp.color; record = $g.opp.record }
  $tjW = $g.score[0] -gt $g.score[1]
  $events = Get-Content (Join-Path $PSScriptRoot "events-$($g.key).json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $last = $events[-1]; $replay = @([int]$last.s[0], [int]$last.s[1])
  $ftNote = ''
  if ($replay[0] -ne $g.score[0] -or $replay[1] -ne $g.score[1]) {
    $dTJ = $g.score[0] - $replay[0]; $dOP = $g.score[1] - $replay[1]
    $ftNote = "free throws weren't tagged on film for this game ($($TJ.code) $dTJ, $($O.code) $dOP)"
  }
  $cams = @(); foreach ($c in $g.cams) { $cams += @{ label = $c.label; id = $c.id; url = "https://api.sportsvisio-api.com/media/$($g.gameId)/$($c.id)/transcoded/full.mp4" } }
  $fullUrl = $cams[$g.defaultCam].url; $fullLen = Clock $camLen[$g.key]
  $awayT = if ($g.tjHome) { $O } else { $TJ }; $homeT = if ($g.tjHome) { $TJ } else { $O }
  $awayScore = if ($g.tjHome) { $g.score[1] } else { $g.score[0] }; $homeScore = if ($g.tjHome) { $g.score[0] } else { $g.score[1] }
  $title = if ($g.tjHome) { "$($O.name) at Team Jeremy" } else { "Team Jeremy at $($O.name)" }
  $docTitle = if ($tjW) { "Team Jeremy $($g.score[0]), $($O.name) $($g.score[1])" } else { "$($O.name) $($g.score[1]), Team Jeremy $($g.score[0])" }

  # ---- box score sums and helpers ----
  function Tot($rows) {
    $t = @{ pts = 0; reb = 0; ast = 0; stl = 0; blk = 0; tov = 0; pf = 0; fgm = 0; fga = 0; tpm = 0; tpa = 0; ftm = 0; fta = 0 }
    foreach ($r in $rows) { $t.pts += $r[2]; $t.reb += $r[3]; $t.ast += $r[4]; $t.stl += $r[5]; $t.blk += $r[6]; $t.tov += $r[7]; $t.pf += $r[8]
      $a = MA $r[9]; $b = MA $r[10]; $c = MA $r[11]; $t.fgm += $a[0]; $t.fga += $a[1]; $t.tpm += $b[0]; $t.tpa += $b[1]; $t.ftm += $c[0]; $t.fta += $c[1]
      if (2 * ($a[0] - $b[0]) + 3 * $b[0] + $c[0] -ne $r[2]) { throw "$($g.key): points don't add up for $($r[0])" } }
    $t }
  $tA = Tot $g.box.TJ; $tB = Tot $g.box.OPP
  if ($tA.pts -ne $g.score[0] -or $tB.pts -ne $g.score[1]) { throw "$($g.key): box totals $($tA.pts)-$($tB.pts)" }
  function Lead($rows, $col) { $best = $rows[0]; foreach ($r in $rows) { if ($r[$col] -gt $best[$col]) { $best = $r } }; $best }

  # ---- header, games strip ----
  $strip = foreach ($s in $stripGames) {
    $inner = '<span class="muted">' + $s.date + ' &middot; ' + $s.opp + '</span><b><span class="gs-' + $s.res.ToLower() + '">' + $s.res + '</span> ' + $s.score + '</b>'
    if ($s.key -eq $g.key) { '      <span aria-current="page">' + $inner + '</span>' } else { '      <a href="' + $s.file + '">' + $inner + '</a>' } }
  $strip += '      <span class="gs-next"><span>Next &middot; Thu, Nov 19</span><b>vs Team Martin</b></span>'
  function TeamSide($T, $score, $isAway, $won) {
    $nameHtml = if ($T.code -eq 'TJ') { '<a href="team.html">Team Jeremy</a>' } else { '<span class="gc-tn">' + $T.name + '</span>' }
    $rec = if ($T.code -eq 'TJ') { if ($g.tjHome) { '2-1, 1-0 Home' } else { '2-1, 1-1 Away' } } else { $T.record }
    $crest = '<span class="crest crest-lg" style="background:' + $T.color + '">' + $T.code + '</span>'
    $nm = '<div class="gc-team-name">' + $nameHtml + '<span>' + $rec + '</span></div>'
    $sc = '<span class="gc-score' + $(if ($won) { ' gc-winner' } else { '' }) + '">' + $score + '</span>'
    if ($isAway) { '      <div class="gc-team gc-away">' + $nl + '        ' + $crest + $nl + '        ' + $nm + $nl + '        ' + $sc + $nl + '      </div>' }
    else { '      <div class="gc-team gc-home">' + $nl + '        ' + $sc + $nl + '        ' + $nm + $nl + '        ' + $crest + $nl + '      </div>' }
  }
  $awayWon = $awayScore -gt $homeScore
  $head = @"
    <section class="gc-head" aria-label="Final score" style="background:linear-gradient(90deg, color-mix(in srgb, $($awayT.color) 55%, var(--navy-900)) 0%, var(--navy-900) 38%, var(--navy-900) 62%, color-mix(in srgb, $($homeT.color) 55%, var(--navy-900)) 100%)">
$(TeamSide $awayT $awayScore $true $awayWon)
      <div class="gc-mid">
        <span class="gc-final">Final</span>
        <table class="gc-line" aria-label="Line score">
          <thead><tr><th scope="col"><span class="sr-only">Team</span></th><th scope="col">T</th></tr></thead>
          <tbody><tr><th scope="row">$($awayT.code)</th><td>$(if ($awayWon) { "<b>$awayScore</b>" } else { $awayScore })</td></tr><tr><th scope="row">$($homeT.code)</th><td>$(if (-not $awayWon) { "<b>$homeScore</b>" } else { $homeScore })</td></tr></tbody>
        </table>
        <span class="gc-when">$($g.dateDay) &middot; $($g.time)</span>
      </div>
$(TeamSide $homeT $homeScore $false (-not $awayWon))
    </section>
"@

  # ---- highlight strip: full game + Bryson Brown's made threes ----
  $bbThrees = @($events | Where-Object { $_.p -eq 'Bryson Brown' -and $_.v -eq 3 })
  $hl = @('            <button type="button" class="gc-hl recap-clip" aria-pressed="true" data-src="' + $fullUrl + '" data-full data-title="Full game &mdash; ' + $title + '"><span class="gc-hl-thumb gc-hl-full" style="background:linear-gradient(135deg, ' + $TJ.color + ', ' + $O.color + ')"><span>Full game</span><i>' + $fullLen + '</i></span><span class="gc-hl-title">' + $title + ': full game</span></button>')
  $i = 0
  foreach ($e in $bbThrees) { $i++
    $hl += '            <button type="button" class="gc-hl recap-clip" data-src="' + $e.src + '" data-title="Bryson Brown 3-pointer (' + $i + ' of ' + $bbThrees.Count + ') &middot; Film ' + (FilmT $e.t) + '"><span class="gc-hl-thumb"><img src="' + ($e.src -replace 'clip\.mp4$', 'clip.0000001.jpg') + '" alt="" loading="lazy"><i>0:07</i></span><span class="gc-hl-title">Bryson Brown 3-pointer (' + $i + ' of ' + $bbThrees.Count + ')</span></button>' }

  # ---- story (written from the box score only) ----
  $a1 = $g.box.TJ[0]; $a2 = $g.box.TJ[1]; $b1 = $g.box.OPP[0]; $b2 = $g.box.OPP[1]
  function Shoot($r) { $f = MA $r[9]; $t3 = MA $r[10]; $ft = MA $r[11]
    $s = "$($f[0])-of-$($f[1]) shooting"
    if ($t3[1]) { $s += ", including $($t3[0]) of $($t3[1]) from three" }
    if ($ft[1]) { if ($ft[0] -eq $ft[1] -and $ft[1] -ge 4) { $s += " and a perfect $($ft[0]) of $($ft[1]) at the line" } else { $s += " and $($ft[0]) of $($ft[1]) at the line" } }
    $s }
  $loc = if ($g.tjHome) { 'at home' } else { 'on the road' }
  $aReb = Lead $g.box.TJ 3
  if ($tjW) {
    $headline = if ($g.tjHome) { "$(Last $a1[0]) scores $($a1[2]) as Team Jeremy beats $($O.name) $($g.score[0])&ndash;$($g.score[1])" } else { "$(Last $a1[0]) scores $($a1[2]) as Team Jeremy wins $($g.score[0])&ndash;$($g.score[1]) at $($O.name)" }
    $p1 = "$($a1[0]) scored $($a1[2]) points on $(Shoot $a1), to lead Team Jeremy past $($O.name) $($g.score[0])&ndash;$($g.score[1]) $loc. $(Last $a1[0]) also had $($a1[3]) rebounds and $($a1[4]) assists, and the win moved Team Jeremy to $($g.tjRecordThen)."
  } else {
    $headline = "$(Last $b1[0]) scores $($b1[2]) as $($O.name) beats Team Jeremy $($g.score[1])&ndash;$($g.score[0])"
    $p1 = "$($b1[0]) scored $($b1[2]) points on $(Shoot $b1), and grabbed $($b1[3]) rebounds, as $($O.name) beat Team Jeremy $($g.score[1])&ndash;$($g.score[0])$(if ($g.tjHome) { ' on the road' } else { ' at home' }). $($a1[0]) led Team Jeremy with $($a1[2]) points on $(Shoot $a1), and the loss left Team Jeremy at $($g.tjRecordThen)."
  }
  $p2 = "$($a2[0]) added $($a2[2]) points for Team Jeremy on $((MA $a2[9])[0])-of-$((MA $a2[9])[1]) shooting"
  if ($aReb[0] -ne $a1[0] -and $aReb[0] -ne $a2[0]) { $p2 += ", and $($aReb[0]) grabbed $($aReb[3]) rebounds" } elseif ($aReb[0] -eq $a1[0] -and -not $tjW) { $p2 += ", and $(Last $a1[0]) also had $($a1[3]) rebounds" }
  $p2 += ". Team Jeremy shot $(F1 (100 * $tA.fgm / $tA.fga))% from the field to $($O.name)'s $(F1 (100 * $tB.fgm / $tB.fga))% and had $($tA.tov) turnovers to $($O.name)'s $($tB.tov). "
  if ($tjW) { $p2 += "$($b1[0]) led $($O.name) with $($b1[2]) points, $($b1[3]) rebounds and $($b1[4]) assists, and $($b2[0]) added $($b2[2])." }
  else { $p2 += "$($b2[0]) added $($b2[2]) points for $($O.name)." }

  # ---- game leaders ----
  function Ldr($r, $val, $sub, $color) {
    $isBB = $r[0] -eq 'Bryson Brown'
    $pic = if ($isBB) { '<span class="avatar avatar-photo gc-ldr-pic"><img src="assets/img/headshot-placeholder.webp" alt=""></span>' } else { '<span class="avatar gc-ldr-pic" style="background:' + $color + ';color:#fff">' + (Init $r[0]) + '</span>' }
    $nm = $r[0] -replace ' \(2nd listing\)$', ''
    $nmHtml = if ($isBB) { '<a href="player.html">B. Brown</a>' } elseif ($nm -match '^Player #|^\S+$') { $nm } else { $nm.Substring(0, 1) + '. ' + ($nm -split ' ')[-1] }
    '<div class="gc-ldr">' + $pic + '<div><span class="gc-ldr-val">' + $val + '</span><span class="gc-ldr-name">' + $nmHtml + '</span><span class="gc-ldr-sub">' + $sub + '</span></div></div>' }
  function PtsSub($r) { $f = MA $r[9]; $ft = MA $r[11]; "$($f[0])/$($f[1]) FG, $($ft[0])/$($ft[1]) FT" }
  function RebSub($r) { $f = MA $r[9]; "$($r[2]) PTS, $($f[0])/$($f[1]) FG" }
  function AstSub($r) { "$($r[7]) TO, $($r[2]) PTS" }
  $lr = @()
  foreach ($cat in @(@('Points', 2, 'PtsSub'), @('Rebounds', 3, 'RebSub'), @('Assists', 4, 'AstSub'))) {
    $ra = Lead $g.box.TJ $cat[1]; $rb = Lead $g.box.OPP $cat[1]
    $lr += '            <div class="gc-ldr-row"><div class="gc-ldr-cat">' + $cat[0] + '</div>' + (Ldr $ra $ra[$cat[1]] (& $cat[2] $ra) $TJ.color) + (Ldr $rb $rb[$cat[1]] (& $cat[2] $rb) $O.color) + '</div>' }

  # ---- team stat bars ----
  function Bar($label, $a, $b, $aSub, $bSub, $fmt, $lowerBetter) {
    $sa = [double]$a; $sb = [double]$b; $tot = $sa + $sb; $wa = if ($tot) { [Math]::Round(100 * $sa / $tot) } else { 50 }; $wb = 100 - $wa
    $lead = if ($sa -eq $sb) { '' } elseif (($sa -gt $sb) -xor $lowerBetter) { 'a' } else { 'b' }
    $va = [string]::Format($ic, $fmt, $sa); $vb = [string]::Format($ic, $fmt, $sb)
    '            <div class="gc-stat"><div class="gc-stat-vals"><span class="' + $(if ($lead -eq 'a') { 'lead' }) + '">' + $va + $(if ($aSub) { ' <small>(' + $aSub + ')</small>' }) + '</span><b>' + $label + '</b><span class="' + $(if ($lead -eq 'b') { 'lead' }) + '">' + $vb + $(if ($bSub) { ' <small>(' + $bSub + ')</small>' }) + '</span></div><div class="gc-stat-bars" aria-hidden="true"><span class="gc-bar-a" style="width:' + $wa + '%"></span><span class="gc-bar-b" style="width:' + $wb + '%"></span></div></div>' }
  $pct = { param($m, $a) if ($a) { 100.0 * $m / $a } else { 0 } }
  $core = @(
    (Bar 'Field Goal %' (& $pct $tA.fgm $tA.fga) (& $pct $tB.fgm $tB.fga) "$($tA.fgm)-$($tA.fga)" "$($tB.fgm)-$($tB.fga)" '{0:0.0}%' $false),
    (Bar 'Three Point %' (& $pct $tA.tpm $tA.tpa) (& $pct $tB.tpm $tB.tpa) "$($tA.tpm)-$($tA.tpa)" "$($tB.tpm)-$($tB.tpa)" '{0:0.0}%' $false),
    (Bar 'Free Throw %' (& $pct $tA.ftm $tA.fta) (& $pct $tB.ftm $tB.fta) "$($tA.ftm)-$($tA.fta)" "$($tB.ftm)-$($tB.fta)" '{0:0.0}%' $false),
    (Bar 'Rebounds' $tA.reb $tB.reb '' '' '{0}' $false),
    (Bar 'Assists' $tA.ast $tB.ast '' '' '{0}' $false),
    (Bar 'Turnovers' $tA.tov $tB.tov '' '' '{0}' $true))
  $more = @(
    (Bar 'Steals' $tA.stl $tB.stl '' '' '{0}' $false),
    (Bar 'Blocks' $tA.blk $tB.blk '' '' '{0}' $false),
    (Bar 'Personal Fouls' $tA.pf $tB.pf '' '' '{0}' $true),
    (Bar 'Effective FG %' $g.four.TJ[0] $g.four.OPP[0] '' '' '{0:0.0}%' $false),
    (Bar 'Turnover Rate' $g.four.TJ[1] $g.four.OPP[1] '' '' '{0:0.0}%' $true),
    (Bar 'Offensive Rebound %' $g.four.TJ[2] $g.four.OPP[2] '' '' '{0:0.0}%' $false),
    (Bar 'Free Throw Rate' $g.four.TJ[3] $g.four.OPP[3] '' '' '{0:0.0}%' $false))

  # ---- box score tables ----
  function BoxTable($rows, $T, $tt) {
    $body = foreach ($r in $rows) {
      $a = MA $r[9]; $b = MA $r[10]; $c = MA $r[11]
      $name = if ($r[0] -eq 'Bryson Brown') { '<a href="player.html">Bryson Brown</a>' } else { HtmlE $r[0] }
      '              <tr><th scope="row">' + $name + '</th>' + ((2..8 | ForEach-Object { '<td class="num">' + $r[$_] + '</td>' }) -join '') + '<td class="num">' + $r[9] + '</td><td class="num">' + (BR $a[0] $a[1]) + '</td><td class="num">' + $r[10] + '</td><td class="num">' + (BR $b[0] $b[1]) + '</td><td class="num">' + $r[11] + '</td><td class="num">' + (BR $c[0] $c[1]) + '</td></tr>' }
    $foot = '<tr><th scope="row">Team</th>' + ((@($tt.pts, $tt.reb, $tt.ast, $tt.stl, $tt.blk, $tt.tov, $tt.pf) | ForEach-Object { '<td class="num">' + $_ + '</td>' }) -join '') + '<td class="num">' + "$($tt.fgm)-$($tt.fga)" + '</td><td class="num">' + (BR $tt.fgm $tt.fga) + '</td><td class="num">' + "$($tt.tpm)-$($tt.tpa)" + '</td><td class="num">' + (BR $tt.tpm $tt.tpa) + '</td><td class="num">' + "$($tt.ftm)-$($tt.fta)" + '</td><td class="num">' + (BR $tt.ftm $tt.fta) + '</td></tr>'
    $dup = if ($rows | Where-Object { $_[0] -like '*(2nd listing)' }) { $nl + '          <p class="muted" style="font-size:var(--text-xs);margin-top:var(--space-2)">SportsVisio lists Cade Stuart twice (same player ID); both rows are shown as published.</p>' } else { '' }
    '        <div class="card card-pad pergame-card">' + $nl +
    '          <div class="pergame-head"><h3>' + $T.name + ' <span class="muted" style="font-weight:400;font-size:var(--text-sm)">' + $tt.pts + ' points</span></h3></div>' + $nl +
    '          <div class="pergame-scroll">' + $nl + '          <table class="pergame-table box-table">' + $nl +
    '            <thead><tr><th scope="col">Player</th><th scope="col" class="num" title="Points">PTS</th><th scope="col" class="num" title="Total Rebounds">TRB</th><th scope="col" class="num" title="Assists">AST</th><th scope="col" class="num" title="Steals">STL</th><th scope="col" class="num" title="Blocks">BLK</th><th scope="col" class="num" title="Turnovers">TOV</th><th scope="col" class="num" title="Personal Fouls">PF</th><th scope="col" class="num" title="Field Goals made-attempted">FG</th><th scope="col" class="num" title="Field Goal Percentage">FG%</th><th scope="col" class="num" title="3-Pointers made-attempted">3P</th><th scope="col" class="num" title="3-Point Percentage">3P%</th><th scope="col" class="num" title="Free Throws made-attempted">FT</th><th scope="col" class="num" title="Free Throw Percentage">FT%</th></tr></thead>' + $nl +
    '            <tbody>' + $nl + ($body -join $nl) + $nl + '            </tbody>' + $nl + '            <tfoot>' + $foot + '</tfoot>' + $nl +
    '          </table>' + $nl + '          </div>' + $dup + $nl + '        </div>' }
  $boxA = BoxTable $g.box.TJ $TJ $tA; $boxB = BoxTable $g.box.OPP $O $tB
  $boxes = if ($g.tjHome) { @($boxB, $boxA) } else { @($boxA, $boxB) }   # away team first

  # ---- matchups, standings ----
  $series = foreach ($s in $g.series) {
    $res = if ($s[4] -and $s[4] -ne $g.file) { '<a href="' + $s[4] + '">' + $s[3] + '</a>' } else { $s[3] }
    '              <li><span class="muted">' + $s[0] + ' &middot; ' + $s[1] + '</span><span>' + $s[2] + '</span><b>' + $res + '</b></li>' }
  $standings = @(@('Team Jeremy', 2, 1, '.667', '&ndash;', '+13.0'), @('Team Martin', 2, 1, '.667', '&ndash;', '+14.0'), @('Team Paul', 2, 2, '.500', '0.5', '+0.5'), @('Team Turbo', 1, 2, '.333', '1', '&minus;22.3'), @('Team Evan', 1, 2, '.333', '1', '&minus;5.3'))
  $stand = foreach ($s in $standings) {
    $hi = $s[0] -eq 'Team Jeremy' -or $s[0] -eq $O.name
    $nm = if ($s[0] -eq 'Team Jeremy') { '<a href="team.html">Team Jeremy</a>' } else { $s[0] }
    '              <tr' + $(if ($hi) { ' class="gc-hilite"' }) + '><th scope="row">' + $nm + '</th><td class="num">' + $s[1] + '</td><td class="num">' + $s[2] + '</td><td class="num">' + $s[3] + '</td><td class="num">' + $s[4] + '</td><td class="num">' + $s[5] + '</td></tr>' }

  # ---- data blocks ----
  $evJson = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "events-$($g.key).json")).Trim()
  if ($ftNote) { $evJson = $evJson.TrimEnd(']') + ",`n" + '{"t":null,"tm":null,"p":null,"d":"Free throws weren''t tagged on film for this game: ' + "$($TJ.code) +$($g.score[0] - $replay[0]), $($O.code) +$($g.score[1] - $replay[1])" + ' to the final","v":0,"s":[' + $g.score[0] + ',' + $g.score[1] + '],"src":null}]' }
  $camJson = ($cams | ForEach-Object { '{"label":"' + $_.label + '","id":"' + $_.id + '","url":"' + $_.url + '"}' }) -join ','
  $meta = '{"tj":{"code":"TJ","name":"Team Jeremy","color":"' + $TJ.color + '"},"opp":{"code":"' + $O.code + '","name":"' + $O.name + '","color":"' + $O.color + '"},"final":[' + $g.score[0] + ',' + $g.score[1] + '],"cams":[' + $camJson + '],"defaultCam":' + $g.defaultCam + ',"fullLen":"' + $fullLen + '","title":"' + $title + '","dateDay":"' + $g.dateDay + '"' + $(if ($ftNote) { ',"ftNote":"' + $ftNote.Replace("'", '\u0027') + '"' }) + '}'
  # ---- shot chart data: every field-goal attempt from the box score, by player; tagged shots carry their clip ----
  $shotRows = @()
  foreach ($side in 'TJ', 'OPP') {
    $code = if ($side -eq 'TJ') { 'TJ' } else { $O.code }
    $agg = [ordered]@{}
    foreach ($r in $g.box.$side) {
      $nm = $r[0] -replace ' \(2nd listing\)$', ''
      if (-not $agg.Contains($nm)) { $agg[$nm] = @(0, 0, 0, 0) }   # made 2, missed 2, made 3, missed 3
      $fgx = MA $r[9]; $t3x = MA $r[10]
      $agg[$nm][0] += $fgx[0] - $t3x[0]; $agg[$nm][1] += ($fgx[1] - $t3x[1]) - ($fgx[0] - $t3x[0]); $agg[$nm][2] += $t3x[0]; $agg[$nm][3] += $t3x[1] - $t3x[0]
    }
    foreach ($nm in $agg.Keys) {
      $evs = @($events | Where-Object { $_.tm -eq $code -and $_.p -eq $nm })
      foreach ($kind in @(@(2, 1, 0, 'makes 2-point'), @(2, 0, 1, 'misses 2-point'), @(3, 1, 2, 'makes 3-pointer'), @(3, 0, 3, 'misses 3-pointer'))) {
        $tagged = @($evs | Where-Object { $_.d -like "$($kind[3])*" })
        $need = $agg[$nm][$kind[2]]
        for ($si = 0; $si -lt $need; $si++) {
          $sj = '{"tm":"' + $code + '","p":"' + $nm + '","k":' + $kind[0] + ',"m":' + $kind[1]
          if ($si -lt $tagged.Count) { $sj += ',"t":"' + $tagged[$si].t + '","src":"' + $tagged[$si].src + '"' }
          $shotRows += $sj + '}'
        }
      }
    }
  }
  $shotsJson = '[' + ($shotRows -join ",`n") + ']'
  $nShots = $shotRows.Count; $nShotClips = @($shotRows | Where-Object { $_ -match '"src"' }).Count
  $nEvents = @($events).Count; $nScore = @($events | Where-Object { $_.v -gt 0 }).Count
  $pbpNote = if ($ftNote) { "Every field goal is here, but <b>free throws weren't tagged on film for this game</b> &mdash; the running score counts field goals only until the last row adds them to reach the $($g.score[0])&ndash;$($g.score[1]) final. Misses, rebounds and other plays are only partly tagged." } else { "Every basket and free throw is here (the running score reaches the $($g.score[0])&ndash;$($g.score[1]) final), plus the misses, rebounds, fouls, steals and other plays SportsVisio tagged on film &mdash; most misses and rebounds aren't tagged." }
  $wpNote = "<b>Game Flow</b> is the real running score from SportsVisio's tagged scoring plays$(if ($ftNote) { " (field goals only &mdash; this game's free throws weren't tagged, so it reaches the final only at the end)" }). <b>Win probability is an estimate</b> from the score margin and how much of the game film has played (no game clock is recorded), using a standard margin-and-time model."
  $camButtons = if ($cams.Count -gt 1) { '<span class="fr-cams" role="group" aria-label="Camera">' + ((0..($cams.Count - 1) | ForEach-Object { '<button type="button" data-fr-cam="' + $_ + '" aria-pressed="' + $(if ($_ -eq $g.defaultCam) { 'true' } else { 'false' }) + '">' + $cams[$_].label + '</button>' }) -join '') + '</span>' } else { '' }
  $gameUrl = "https://uh.sportsvisio.com/league/texas-frisco/game/$($g.gameId)"
  $crumb = if ($g.tjHome) { "$($O.name) at Team Jeremy" } else { "Team Jeremy at $($O.name)" }

  $main = @"
    <p class="muted" style="font-size:var(--text-sm);margin-bottom:var(--space-4)"><a href="games.html" class="muted">Games</a> / $crumb</p>
    <h1 class="sr-only">$crumb, final score $awayScore to $homeScore</h1>
    <nav class="gstrip" aria-label="Team Jeremy's games">
$($strip -join $nl)
    </nav>

$head

    <div class="tabbar" data-tabbar role="tablist" style="margin-top:var(--space-5)">
      <button role="tab" aria-selected="true" aria-controls="p-gamecast" id="t-gamecast">Gamecast</button>
      <button role="tab" aria-selected="false" aria-controls="p-box" id="t-box">Box Score</button>
      <button role="tab" aria-selected="false" aria-controls="p-pbp" id="t-pbp">Play-by-Play</button>
      <button role="tab" aria-selected="false" aria-controls="p-teamstats" id="t-teamstats">Team Stats</button>
      <button role="tab" aria-selected="false" aria-controls="p-film" id="t-film">Film</button>
    </div>

    <div id="p-gamecast" class="tabpanel" role="tabpanel" aria-labelledby="t-gamecast" style="--gc-a:$($TJ.color);--gc-b:$($O.color)">
      <div class="gc-layout">
        <div class="gc-main">
          <section class="card gc-card gc-video" aria-label="Game film">
            <div class="video-frame"><video controls playsinline preload="metadata" data-recap-video src="$fullUrl" aria-label="$title game film"></video></div>
            <p class="gc-video-cap" data-recap-caption>Full game &mdash; $title</p>
            <div class="gc-hl-strip recap-plays" aria-label="Highlights">
$($hl -join $nl)
            </div>
          </section>

          <article class="card gc-card gc-story">
            <h2>$headline</h2>
            <p><strong>&mdash;</strong> $p1</p>
            <p>$p2</p>
            <p class="gc-byline">Auto-generated recap &middot; $($g.dateShort), 2026 &middot; from the <a href="$gameUrl" target="_blank" rel="noopener">SportsVisio game page</a></p>
          </article>

          <section class="card gc-card" aria-labelledby="gc-leaders-h">
            <h2 class="gc-h" id="gc-leaders-h">Game Leaders</h2>
            <div class="gc-ldr-head"><span></span><span><i class="gc-dot" style="background:$($TJ.color)"></i>TJ</span><span><i class="gc-dot" style="background:$($O.color)"></i>$($O.code)</span></div>
$($lr -join $nl)
            <a class="btn btn-outline btn-sm gc-more" href="#p-box" data-open-tab="t-box">Full Box Score</a>
          </section>

          <section class="card gc-card" aria-labelledby="gc-wp-h" data-wp>
            <div class="wp-top">
              <h2 class="gc-h" id="gc-wp-h" style="margin:0">Win Probability &amp; Game Flow</h2>
              <div class="wp-toggle" role="group" aria-label="Chart">
                <button type="button" aria-pressed="true" data-wp-mode="wp">Win Probability</button><button type="button" aria-pressed="false" data-wp-mode="flow">Game Flow</button>
              </div>
            </div>
            <div class="wp-legend" data-wp-legend></div>
            <div class="wp-chart" data-wp-chart></div>
            <p class="wp-readout" data-wp-readout aria-live="polite">Hover or tap the chart to step through the game &middot; click to watch that play.</p>
            <p class="muted" style="font-size:var(--text-xs);margin-top:var(--space-2)">$wpNote</p>
            <a class="btn btn-outline btn-sm gc-more" href="#p-pbp" data-open-tab="t-pbp">Full Play-by-Play</a>
          </section>

          <section class="card gc-card" aria-labelledby="gc-sc-h" data-sc>
            <div class="wp-top">
              <h2 class="gc-h" id="gc-sc-h" style="margin:0">Shot Chart <span class="sc-tag">Placeholder</span></h2>
              <div class="sc-filters">
                <div class="wp-toggle" role="group" aria-label="Team">
                  <button type="button" aria-pressed="true" data-sc-team="">Both</button><button type="button" aria-pressed="false" data-sc-team="TJ">TJ</button><button type="button" aria-pressed="false" data-sc-team="$($O.code)">$($O.code)</button>
                </div>
                <select class="input sc-select" data-sc-result aria-label="Shot result"><option value="">Makes &amp; misses</option><option value="1">Makes</option><option value="0">Misses</option></select>
                <select class="input sc-select" data-sc-player aria-label="Player"><option value="">All players</option></select>
              </div>
            </div>
            <div class="wp-legend" data-sc-legend></div>
            <div class="sc-court" data-sc-court></div>
            <p class="wp-readout" data-sc-readout aria-live="polite">Hover a shot for details &middot; click a shot with film to watch it.</p>
            <p class="muted" style="font-size:var(--text-xs);margin-top:var(--space-2)"><b>Shot locations are placeholders.</b> All $nShots field-goal attempts from the box score are plotted &mdash; the right players, makes, misses, 2s and 3s &mdash; but where each one was taken is estimated, because SportsVisio doesn't record shot locations. $nShotClips of them have film (solid outline); Team Jeremy shoots at the left basket.</p>
          </section>
          <section class="card gc-card" aria-labelledby="gc-ts-h">
            <h2 class="gc-h" id="gc-ts-h">Team Stats</h2>
            <div class="gc-stat-head"><span><i class="gc-dot" style="background:$($TJ.color)"></i>TJ</span><span><i class="gc-dot" style="background:$($O.color)"></i>$($O.code)</span></div>
$($core -join $nl)
            <a class="btn btn-outline btn-sm gc-more" href="#p-teamstats" data-open-tab="t-teamstats">Full Team Stats</a>
          </section>

          <section class="card gc-card" aria-labelledby="gc-info-h">
            <h2 class="gc-h" id="gc-info-h">Game Information</h2>
            <dl class="gc-info">
              <div><dt>Tip-off</dt><dd>$($g.time), $($g.dateLong)</dd></div>
              <div><dt>League</dt><dd>Ultimate Hoops Texas - Frisco &middot; Draft Division</dd></div>
              <div><dt>Home team</dt><dd>$($homeT.name)</dd></div>
              <div><dt>Film</dt><dd>$($cams.Count) camera$(if ($cams.Count -gt 1) { 's' }) &middot; $fullLen</dd></div>
              <div><dt>Stats &amp; film source</dt><dd><a href="$gameUrl" target="_blank" rel="noopener">SportsVisio</a></dd></div>
            </dl>
            <p class="muted" style="font-size:var(--text-xs);margin-top:var(--space-3)">Scoring by quarter, minutes, shot locations and officials aren't recorded for this game.</p>
          </section>
        </div>

        <aside class="gc-side">
          <section class="card gc-card" aria-labelledby="gc-mu-h">
            <h2 class="gc-h" id="gc-mu-h">Matchups</h2>
            <div class="gc-series"><span class="crest" style="background:$($TJ.color)">TJ</span><div><b>$($g.seriesStatus)</b><span class="muted">Season series</span></div><span class="crest" style="background:$($O.color)">$($O.code)</span></div>
            <ol class="gc-games">
$($series -join $nl)
            </ol>
          </section>
          <section class="card gc-card" aria-labelledby="gc-st-h">
            <h2 class="gc-h" id="gc-st-h">Standings</h2>
            <p class="muted" style="font-size:var(--text-xs);margin-bottom:var(--space-2)">Draft Division &middot; Fall 2026</p>
            <table class="gc-standings">
              <thead><tr><th scope="col">Team</th><th scope="col" class="num">W</th><th scope="col" class="num">L</th><th scope="col" class="num">PCT</th><th scope="col" class="num">GB</th><th scope="col" class="num" title="Average point differential per game">+/&minus;</th></tr></thead>
              <tbody>
$($stand -join $nl)
              </tbody>
            </table>
          </section>
        </aside>
      </div>
    </div>

    <div id="p-box" class="tabpanel" role="tabpanel" aria-labelledby="t-box" hidden>
      <div class="stack" style="gap:var(--space-6);margin-bottom:var(--space-8)">
$($boxes -join ($nl + $nl))
      </div>
    </div>

    <div id="p-pbp" class="tabpanel" role="tabpanel" aria-labelledby="t-pbp" hidden>
      <section class="card gc-card pbp-card" aria-label="Play-by-play">
        <div class="pbp-player">
          <div class="video-frame"><video controls playsinline preload="none" data-pbp-video aria-label="Selected play"></video></div>
          <p class="gc-video-cap" data-pbp-caption>Pick a play below to watch it.</p>
        </div>
        <div class="pbp-controls">
          <label for="pbp-filter" class="muted" style="font-size:var(--text-xs)">Show</label>
          <select id="pbp-filter" class="input" data-pbp-filter>
            <option value="all">All tagged plays</option>
            <option value="score">Scoring plays only</option>
            <option value="TJ">Team Jeremy</option>
            <option value="$($O.code)">$($O.name)</option>
          </select>
          <span class="muted pbp-count" data-pbp-count></span>
        </div>
        <div class="pbp-head" aria-hidden="true"><span>Film</span><span></span><span>Play</span><span class="num">TJ</span><span class="num">$($O.code)</span><span></span></div>
        <ol class="pbp-list" data-pbp-list></ol>
        <p class="muted" style="font-size:var(--text-xs);margin-top:var(--space-3)">$pbpNote Times are positions in the game film, not the game clock.</p>
      </section>
    </div>

    <div id="p-teamstats" class="tabpanel" role="tabpanel" aria-labelledby="t-teamstats" hidden style="--gc-a:$($TJ.color);--gc-b:$($O.color)">
      <section class="card gc-card gc-wide" aria-label="Team stats comparison">
        <div class="gc-stat-head"><span><i class="gc-dot" style="background:$($TJ.color)"></i>Team Jeremy</span><span><i class="gc-dot" style="background:$($O.color)"></i>$($O.name)</span></div>
$(($core + $more) -join $nl)
        <p class="muted" style="font-size:var(--text-xs);margin-top:var(--space-4)">Team totals from the box score; Four Factors (Effective FG %, Turnover Rate, Offensive Rebound %, Free Throw Rate) as published by SportsVisio. The bolder number is the better one for each stat.</p>
      </section>
    </div>

    <div id="p-film" class="tabpanel" role="tabpanel" aria-labelledby="t-film" hidden>
      <section class="card fr" aria-label="Film room" data-fr>
        <div class="fr-stage">
          <div class="video-frame"><video controls playsinline preload="metadata" src="$fullUrl" data-fr-video aria-label="Game film"></video></div>
          <div class="fr-now">
            <div class="fr-now-text">
              <span class="fr-now-kicker" data-fr-kicker>Full game</span>
              <h3 class="fr-now-title" data-fr-title>$title</h3>
              <span class="fr-now-meta" data-fr-meta></span>
            </div>
            <div class="fr-now-actions">
              <button type="button" class="btn btn-outline btn-sm" data-fr-prev aria-label="Previous play">&#9664; Prev</button>
              <button type="button" class="btn btn-outline btn-sm" data-fr-next aria-label="Next play">Next &#9654;</button>
              <button type="button" class="btn btn-outline btn-sm" data-fr-ingame hidden>Watch in full game</button>
            </div>
          </div>
          <label class="fr-auto"><input type="checkbox" data-fr-auto checked> Auto-play the next play in the list</label>$camButtons
        </div>
        <div class="fr-side">
          <div class="fr-filters">
            <div class="fr-chips" role="group" aria-label="Plays to show" data-fr-chips>
              <button type="button" aria-pressed="true" data-k="all">All plays</button><button type="button" aria-pressed="false" data-k="score">Scoring</button><button type="button" aria-pressed="false" data-k="three">3-pointers</button><button type="button" aria-pressed="false" data-k="TJ">Team Jeremy</button><button type="button" aria-pressed="false" data-k="$($O.code)">$($O.name)</button>
            </div>
            <select class="input fr-player" data-fr-player aria-label="Player"><option value="">All players</option></select>
          </div>
          <p class="fr-count muted" data-fr-count aria-live="polite"></p>
          <ol class="fr-list" data-fr-list></ol>
        </div>
      </section>
      <p class="muted" style="font-size:var(--text-xs);margin:var(--space-3) 0 var(--space-8)">Full game film and every play SportsVisio tagged on it.$(if ($cams.Count -gt 1) { ' This game was filmed from two synced cameras &mdash; switch angles on the full game; each clip uses the camera it was cut from.' }) Times are positions in the game film; &ldquo;Watch in full game&rdquo; jumps the full film to that moment.</p>
    </div>

    <script type="application/json" id="game-meta">$meta</script>
    <script type="application/json" id="shots-data">
$shotsJson
    </script>
    <script type="application/json" id="pbp-data">
$evJson
    </script>
"@
  # assemble from the current public recap's shell (head, nav, footer)
  $t = $shell
  $t = [regex]::Replace($t, '<title>.*?</title>', ('<title>' + $docTitle + ' — Recap — SGTBL</title>'))
  $t = [regex]::Replace($t, '(?s)<style>.*?</style>', ('<style>' + $nl + $css + $nl + '</style>').Replace('$', '$$'))
  $m = [regex]::Match($t, '(?s)(  <div class="wrap" style="padding-top:var\(--space-6\)">\r?\n)(.*?)(\r?\n  </div>\r?\n</main>)')
  $t = $t.Substring(0, $m.Groups[2].Index) + (N $main) + $t.Substring($m.Groups[2].Index + $m.Groups[2].Length)
  $t = [regex]::Replace($t, '(?s)<script>\r?\n// (Highlight strip|Game recap page script).*?</script>', '')
  $t = [regex]::Replace($t, '(\r?\n)+(<script src="assets/js/interactions\.js\?v=[0-9a-z]+"></script>)', ($nl + '$2' + $nl + (N $pageJs).Replace('$', '$$')))
  [IO.File]::WriteAllText((Join-Path $root $g.file), $t, (New-Object Text.UTF8Encoding $false))
  "$($g.file): $docTitle - $nEvents events ($nScore scoring)$(if ($ftNote) { ' - ' + $ftNote }), $($bbThrees.Count) Brown threes, $($cams.Count) camera(s)"
}
