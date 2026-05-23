Add-Type -AssemblyName System.Drawing

$src = Join-Path $PSScriptRoot "slot machine sprite sheet.png"
$outDir = Join-Path $PSScriptRoot "symbols"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Load source as 32bpp ARGB so every pixel is exactly 4 bytes (B,G,R,A)
$srcOriginal = [System.Drawing.Bitmap]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap $srcOriginal.Width, $srcOriginal.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gPrep = [System.Drawing.Graphics]::FromImage($bmp)
$gPrep.DrawImage($srcOriginal, 0, 0, $srcOriginal.Width, $srcOriginal.Height)
$gPrep.Dispose()
$srcOriginal.Dispose()

# Lock the whole image into a managed byte[] for fast pixel reads
$rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $bmp.PixelFormat)
$stride = $data.Stride
$total = $stride * $bmp.Height
$pixels = New-Object byte[] $total
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $total)
$bmp.UnlockBits($data)

Write-Host "Sheet $($bmp.Width)x$($bmp.Height), stride=$stride"

# Find tight bbox of non-white, non-transparent pixels inside (x1..x2, y1..y2)
function Find-TightBox([int]$x1, [int]$y1, [int]$x2, [int]$y2) {
  $minX = 9999; $minY = 9999; $maxX = -1; $maxY = -1
  for ($y = $y1; $y -lt $y2; $y++) {
    $rowOff = $y * $stride
    for ($x = $x1; $x -lt $x2; $x++) {
      $idx = $rowOff + $x * 4
      $a = $pixels[$idx + 3]
      if ($a -lt 16) { continue }
      $b = $pixels[$idx]
      $gv = $pixels[$idx + 1]
      $r = $pixels[$idx + 2]
      if ($r -gt 245 -and $gv -gt 245 -and $b -gt 245) { continue }
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  if ($maxX -lt 0) { return $null }
  return @{ x = $minX; y = $minY; w = $maxX - $minX + 1; h = $maxY - $minY + 1 }
}

function Export-Sprite([string]$name, [int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$canvas) {
  $box = Find-TightBox $x1 $y1 $x2 $y2
  if ($null -eq $box) {
    Write-Host "skip $name (nothing in region)"
    return
  }

  # Outer side = longest sprite side + a small breathing-room pad
  $side = [Math]::Max($box.w, $box.h)
  $pad = [int]([Math]::Round($side * 0.10))
  $outer = $side + 2 * $pad

  # Scale to canvas, center the sprite within
  $scale = $canvas / [double]$outer
  $drawW = $box.w * $scale
  $drawH = $box.h * $scale
  $dx = ($canvas - $drawW) / 2.0
  $dy = ($canvas - $drawH) / 2.0

  $square = New-Object System.Drawing.Bitmap $canvas, $canvas, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gs = [System.Drawing.Graphics]::FromImage($square)
  $gs.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $gs.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gs.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $srcRect = New-Object System.Drawing.RectangleF $box.x, $box.y, $box.w, $box.h
  $dstRect = New-Object System.Drawing.RectangleF $dx, $dy, $drawW, $drawH
  $gs.DrawImage($bmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $gs.Dispose()

  $out = Join-Path $outDir "$name.png"
  $square.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $square.Dispose()

  Write-Host ("{0,-12} src=({1,3},{2,3}) {3,3}x{4,3}" -f $name, $box.x, $box.y, $box.w, $box.h)
}

# Search regions on the 945x806 sheet. Each region must contain ONE sprite only;
# Find-TightBox then crops to the actual sprite inside.
$C = 256
Export-Sprite "cherry"       0   0  220  200 $C
Export-Sprite "plum"       225   0  470  200 $C
Export-Sprite "clover"     700   0  945  220 $C
Export-Sprite "lemon"        0 230  220  430 $C
Export-Sprite "coin"       230 230  460  430 $C
Export-Sprite "bar"        490 250  760  410 $C
Export-Sprite "apple"      770 230  945  430 $C
Export-Sprite "grape"      240 430  460  620 $C
Export-Sprite "diamond"    470 430  710  620 $C
Export-Sprite "orange"     720 430  945  620 $C
Export-Sprite "seven"      240 615  470  800 $C
Export-Sprite "watermelon" 700 615  945  806 $C

$bmp.Dispose()
Write-Host "done."
