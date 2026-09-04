param(
  [int]$Port = 8843,
  [string]$Root = "$PSScriptRoot\site"
)

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png"; ".gif"="image/gif"; ".svg"="image/svg+xml";
  ".ico"="image/x-icon"; ".woff"="font/woff"; ".woff2"="font/woff2"; ".txt"="text/plain"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $req = $context.Request
  $res = $context.Response
  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $fsPath = Join-Path $Root ($path -replace "^/","")
    $fsPath = [System.IO.Path]::GetFullPath($fsPath)
    if (-not $fsPath.StartsWith([System.IO.Path]::GetFullPath($Root))) {
      $res.StatusCode = 403; $res.Close(); continue
    }
    if (Test-Path $fsPath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($fsPath).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($fsPath)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}
