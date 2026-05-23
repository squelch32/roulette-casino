Add-Type -AssemblyName System.Drawing

$src = Join-Path $PSScriptRoot "slot machine sprite sheet.png"
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width
$h = $bmp.Height

function Test-Bright($color) {
  return ($color.R -gt 35 -or $color.G -gt 35 -or $color.B -gt 35)
}

$labels = New-Object 'System.Collections.Generic.List[object]'
$seen = @{}

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $key = "$x,$y"
    if ($seen.ContainsKey($key)) { continue }
    if (-not (Test-Bright ($bmp.GetPixel($x, $y)))) { continue }

    $stack = New-Object System.Collections.Stack
    $stack.Push(@($x, $y))
    $seen[$key] = $true
    $minX = $x
    $maxX = $x
    $minY = $y
    $maxY = $y
    $count = 0

    while ($stack.Count -gt 0) {
      $p = $stack.Pop()
      $px = $p[0]
      $py = $p[1]
      $count++
      if ($px -lt $minX) { $minX = $px }
      if ($px -gt $maxX) { $maxX = $px }
      if ($py -lt $minY) { $minY = $py }
      if ($py -gt $maxY) { $maxY = $py }

      foreach ($n in @(@($px + 1, $py), @($px - 1, $py), @($px, $py + 1), @($px, $py - 1))) {
        $nx = $n[0]
        $ny = $n[1]
        if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
        $nk = "$nx,$ny"
        if ($seen.ContainsKey($nk)) { continue }
        if (-not (Test-Bright ($bmp.GetPixel($nx, $ny)))) { continue }
        $seen[$nk] = $true
        $stack.Push($n)
      }
    }

    if ($count -gt 800) {
      $labels.Add([pscustomobject]@{
          x     = $minX
          y     = $minY
          w     = ($maxX - $minX + 1)
          h     = ($maxY - $minY + 1)
          cx    = [math]::Round(($minX + $maxX) / 2, 1)
          cy    = [math]::Round(($minY + $maxY) / 2, 1)
          area  = $count
        })
    }
  }
}

$ordered = $labels | Sort-Object cy, cx
$i = 0
foreach ($b in $ordered) {
  Write-Host ("{0,2}: x={1,3} y={2,3} w={3,3} h={4,3} cx={5} cy={6}" -f $i, $b.x, $b.y, $b.w, $b.h, $b.cx, $b.cy)
  $i++
}

$bmp.Dispose()
