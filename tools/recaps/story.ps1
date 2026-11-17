# AP-style game story (structure modeled on wire-service NBA recaps), written only from real data: the box score,
# the league schedule (records, streaks, next games) and - when the scoring log is complete - the play-by-play
# (runs, leads, how the game was decided). Dot-sourced by recap-gen.ps1, which provides MA and F1.
# Build-Story returns @{ headline; dateline; paras; upnext }.

$script:Schedule = Get-Content (Join-Path $PSScriptRoot 'schedule.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$script:IsoDate = @{ oct22 = '2026-10-22'; oct29 = '2026-10-29'; nov5 = '2026-11-05' }

function Wd($n) { $w = 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'; if ($n -ge 0 -and $n -le 9) { $w[$n] } else { [string]$n } }   # AP style: spell out one through nine
function Pl($n, $one, $many) { if ($n -eq 1) { "$(Wd $n) $one" } else { "$(Wd $n) $many" } }
function ApDate($iso) { $d = [datetime]::ParseExact($iso, 'yyyy-MM-dd', $null); $m = @('Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.')[$d.Month - 1]; "$($d.DayOfWeek), $m $($d.Day)" }
function Ord($n) { $s = if (($n % 100) -in 11, 12, 13) { 'th' } else { switch ($n % 10) { 1 { 'st' } 2 { 'nd' } 3 { 'rd' } default { 'th' } } }; "$n$s" }
function Surname($n) { if ($n -match '^Player #' -or $n -notmatch ' ') { $n } else { ($n -split ' ')[-1] } }
function Secs($tc) { $p = $tc.Split(':'); [int]$p[0] * 3600 + [int]$p[1] * 60 + [int]$p[2] }
function Join-And($items) { $items = @($items); if ($items.Count -le 1) { return ($items -join '') }; ($items[0..($items.Count - 2)] -join ', ') + ' and ' + $items[-1] }

# record and current streak for a team after the games played on or before $iso
function TeamForm($team, $iso) {
  $w = 0; $l = 0; $streak = 0; $last = ''
  foreach ($x in ($script:Schedule | Where-Object { $_.date -le $iso -and $null -ne $_.hs } | Sort-Object date, time)) {
    if ($x.home -ne $team -and $x.away -ne $team) { continue }
    $won = if ($x.home -eq $team) { $x.hs -gt $x.as } else { $x.as -gt $x.hs }
    if ($won) { $w++ } else { $l++ }
    $r = if ($won) { 'W' } else { 'L' }
    if ($r -eq $last) { $streak++ } else { $streak = 1; $last = $r }
  }
  @{ w = $w; l = $l; rec = "$w-$l"; streak = $streak; last = $last; games = $w + $l }
}
function NextGame($team, $iso) {
  $x = $script:Schedule | Where-Object { $_.date -gt $iso -and ($_.home -eq $team -or $_.away -eq $team) } | Sort-Object date, time | Select-Object -First 1
  if (-not $x) { return 'Season continues.' }
  $verb = if ($x.home -eq $team) { 'Host' } else { 'Visit' }; $opp = if ($x.home -eq $team) { $x.away } else { $x.home }
  "$verb $opp on $(ApDate $x.date)."
}
# box row [name, id, pts, reb, ast, stl, blk, tov, pf, fg, 3p, ft] -> "30 points, eight rebounds and seven assists"
function StatLine($r) {
  $parts = @("$($r[2]) points")
  if ($r[3] -ge 5) { $parts += Pl $r[3] 'rebound' 'rebounds' }
  if ($r[4] -ge 4) { $parts += Pl $r[4] 'assist' 'assists' }
  if ($r[5] -ge 3) { $parts += Pl $r[5] 'steal' 'steals' }
  if ($r[6] -ge 2) { $parts += Pl $r[6] 'block' 'blocks' }
  Join-And $parts
}
function PlayNoun($d) { switch -Wildcard ($d) { '*3-pointer' { '3-pointer' } '*free throw' { 'free throw' } default { 'basket' } } }

function Build-Story($g, $events, $tA, $tB, $O, $ftNote) {
  $iso = $script:IsoDate[$g.key]
  $tjW = $g.score[0] -gt $g.score[1]
  $TJside = @{ name = 'Team Jeremy'; code = 'TJ'; box = $g.box.TJ; tot = $tA; pts = $g.score[0]; idx = 0 }
  $OPside = @{ name = $O.name; code = $O.code; box = $g.box.OPP; tot = $tB; pts = $g.score[1]; idx = 1 }
  $W = if ($tjW) { $TJside } else { $OPside }; $L = if ($tjW) { $OPside } else { $TJside }
  $fW = TeamForm $W.name $iso; $fL = TeamForm $L.name $iso
  $score = "$($W.pts)-$($L.pts)"
  $star = $W.box[0]; $second = $W.box[1]; $lStar = $L.box[0]; $lSecond = $L.box[1]
  $winnerHome = ($tjW -and $g.tjHome) -or (-not $tjW -and -not $g.tjHome)
  $night = (ApDate $iso).Split(',')[0] + ' night'

  # ---- context (from the league schedule) ----
  $firstLoss = $fL.l -eq 1 -and $fL.games -gt 1
  if ($fW.games -eq 1 -and $fL.games -eq 1) { $ctxHead = ' in season opener'; $ctxLead = ' in the season opener for both teams' }
  elseif ($firstLoss) { $ctxHead = ''; $ctxLead = ", handing $($L.name) its first loss of the season" }
  elseif ($fW.streak -ge 2) { $ctxHead = " for $(Ord $fW.streak) straight win"; $ctxLead = " for its $(Ord $fW.streak) straight victory" }
  elseif ($fW.games -gt 1) { $ctxHead = ' to bounce back'; $ctxLead = ' to bounce back from a loss' }
  else { $ctxHead = ''; $ctxLead = '' }

  $headline = if ($firstLoss) { "$(Surname $star[0]) scores $($star[2]) as $($W.name) hands $($L.name) first loss, $score" }
              else { "$(Surname $star[0]) scores $($star[2]), $($W.name) beats $($L.name) $score$ctxHead" }

  # ---- box-score paragraphs ----
  $where = if ($winnerHome) { '' } else { ' on the road' }
  $paras = @("$($star[0]) had $(StatLine $star) to lead $($W.name) past $($L.name) $score$where on $night$ctxLead.")
  $fgS = MA $star[9]; $t3S = MA $star[10]; $ftS = MA $star[11]
  $bits = @("$($fgS[0]) of $($fgS[1]) shots from the field")
  if ($t3S[0] -ge 3) { $bits += "$($t3S[0]) of $($t3S[1]) from 3-point range" }
  if ($ftS[1] -ge 4) { $bits += $(if ($ftS[0] -eq $ftS[1]) { "all $(Wd $ftS[1]) free throws" } else { "$($ftS[0]) of $($ftS[1]) free throws" }) }
  $paras += "$(Surname $star[0]) made $(Join-And $bits)."
  $p3 = "$($second[0]) added $(StatLine $second)"
  $dd = @($W.box | Where-Object { $_[0] -ne $star[0] -and $_[0] -ne $second[0] -and (@($_[2], $_[3], $_[4]) | Where-Object { $_ -ge 10 }).Count -ge 2 })
  if ($dd.Count) { $p3 += ", and $($dd[0][0]) had $(StatLine $dd[0])" }
  $paras += "$p3."
  $tW = $W.tot
  $p4 = "$($W.name) shot $(F1 (100 * $tW.fgm / $tW.fga))% ($($tW.fgm) of $($tW.fga)) from the field"
  if ($tW.tpm -ge 6) { $p4 += " and made $(Wd $tW.tpm) 3-pointers" }
  if ($tW.tov -le $L.tot.tov - 3) { $p4 += ", committing only $(Pl $tW.tov 'turnover' 'turnovers')" }
  $paras += "$p4."
  $p5 = "$($L.name) fell to $($fL.rec)."
  if ($fL.last -eq 'L' -and $fL.streak -ge 2) { $p5 += " It was the team's $(Ord $fL.streak) straight loss." }
  $paras += "$p5 $($lStar[0]) led $($L.name) with $(StatLine $lStar)."
  $p6 = "$($lSecond[0]) added $($lSecond[2]) points"
  if ($L.box.Count -gt 2 -and $L.box[2][2] -ge 10) { $p6 += " and $($L.box[2][0]) had $($L.box[2][2])" }
  $paras += "$p6."

  # ---- how the game went: only when every point is on the play-by-play ----
  if (-not $ftNote) {
    $sc = @($events | Where-Object { $_.v -gt 0 })
    $wi = $W.idx; $li = $L.idx
    function WScore($s) { "$([int]$s[$wi])-$([int]$s[$li])" }   # winner's score first
    function LScore($s) { "$([int]$s[$li])-$([int]$s[$wi])" }  # loser's score first
    # biggest unanswered run for each team
    $runs = @{}; $cur = $null; $pts = 0
    foreach ($e in $sc) {
      if ($e.tm -ne $cur) { $cur = $e.tm; $pts = 0 }
      $pts += $e.v
      if (-not $runs[$cur] -or $pts -gt $runs[$cur].pts) { $runs[$cur] = @{ pts = $pts; at = $e } }
    }
    $maxW = 0; $maxL = 0; $changes = 0; $leader = 0
    foreach ($e in $sc) {
      $m = [int]$e.s[$wi] - [int]$e.s[$li]
      if ($m -gt $maxW) { $maxW = $m }; if (-$m -gt $maxL) { $maxL = -$m }
      $sg = [Math]::Sign($m); if ($sg -ne 0) { if ($leader -ne 0 -and $sg -ne $leader) { $changes++ }; $leader = $sg }
    }
    $t0 = Secs $sc[0].t; $t1 = Secs $sc[-1].t; $mid = @($sc | Where-Object { (Secs $_.t) -le ($t0 + $t1) / 2 })[-1]
    $midM = [int]$mid.s[$wi] - [int]$mid.s[$li]
    $ahead = $null; for ($i = $sc.Count - 1; $i -ge 0; $i--) { if (([int]$sc[$i].s[$wi] - [int]$sc[$i].s[$li]) -le 0) { break }; $ahead = $sc[$i] }

    # paragraph 1: the early going, the winner's big run and the midpoint, in the order they happened
    $rW = $runs[$W.code]; $rL = $runs[$L.code]
    $tMid = ($t0 + $t1) / 2
    $open = if ($maxL -eq 0) { "$($W.name) never trailed" } elseif ($changes -ge 3) { "The lead changed hands $(Pl $changes 'time' 'times') before $($W.name) took control" } else { "$($L.name) led by as many as $(Wd $maxL) early" }
    $midTxt = if ($midM -gt 0) { "$($W.name) was up $(WScore $mid.s) midway through the game" } elseif ($midM -lt 0) { "$($L.name) led $(LScore $mid.s) midway through the game" } else { "the game was tied at $($mid.s[0]) midway through" }
    $s1 = if ($maxL -eq 0 -and $midM -gt 0) { "$open and was up $(WScore $mid.s) midway through the game." } else { "$open. $($midTxt.Substring(0,1).ToUpper() + $midTxt.Substring(1))." }
    if ($rW -and $rW.pts -ge 8) {
      $runSentence = "A $($rW.pts)-0 $($W.name) run, capped by $($rW.at.p)'s $(PlayNoun $rW.at.d), made it $(WScore $rW.at.s)."
      if ((Secs $rW.at.t) -le $tMid) { $s1 = "$open. $runSentence $($midTxt.Substring(0,1).ToUpper() + $midTxt.Substring(1))." }
      else { $s1 += " $runSentence" }
    }
    $paras += $s1
    # paragraph 2: the other side's best push, the biggest lead and who closed it out
    $f2 = @()
    if ($rL -and $rL.pts -ge 8) { $f2 += "$($L.name)'s best stretch was a $($rL.pts)-0 run that made it $(LScore $rL.at.s)." }
    if ($maxW -ge 10) {
      $late = $ahead -and ((Secs $ahead.t) - $t0) -gt 0.25 * ($t1 - $t0)
      $f2 += "$($W.name) led by as many as $(Wd $maxW)" + $(if ($late) { " after going ahead for good at $(WScore $ahead.s)" }) + '.'
    }
    $fin = @($sc | Where-Object { $_.tm -eq $W.code } | Select-Object -Last 2)
    if ($fin.Count -eq 2 -and ($fin[0].v + $fin[1].v) -ge 4) {
      $finPts = $fin[0].v + $fin[1].v
      $f2 += $(if ($fin[0].p -eq $fin[1].p) { "$($fin[0].p) scored $($W.name)'s final $finPts points." } else { "$($fin[0].p) and $($fin[1].p) scored $($W.name)'s final $finPts points." })
    }
    if ($f2.Count) { $paras += ($f2 -join ' ') }
  }

  $up = @("Team Jeremy: $(NextGame 'Team Jeremy' $iso)", "$($O.name): $(NextGame $O.name $iso)")
  @{ headline = $headline; dateline = "Frisco, Texas &middot; $(ApDate $iso), 2026"; paras = $paras; upnext = $up }
}