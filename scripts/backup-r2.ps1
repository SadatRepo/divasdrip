param(
  [switch]$Remote,
  [string]$Bucket = "my-store-images",
  [string]$Database = "my-store-db",
  [string]$OutputDirectory = "backups/r2"
)

if (-not $Remote) {
  throw "Refusing to read a remote bucket by default. Re-run with -Remote after verifying the bucket and Wrangler account."
}

$root = (Get-Location).Path
$directory = [System.IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $directory ("my-store-images-" + $stamp)
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null

$query = "SELECT object_key, mime_type FROM media WHERE status = 'ready' AND object_key IS NOT NULL ORDER BY object_key"
$jsonText = (& npx wrangler d1 execute $Database --remote --command $query --json | Out-String)
if ($LASTEXITCODE -ne 0) {
  throw "Unable to enumerate media metadata from D1."
}
try {
  $payload = $jsonText | ConvertFrom-Json
} catch {
  throw "Wrangler did not return valid JSON while enumerating media metadata."
}

$rows = @()
foreach ($result in @($payload)) {
  if ($null -ne $result.results) {
    $rows += @($result.results)
  }
}
if ($rows.Count -eq 0 -and $null -ne $payload.results) {
  $rows = @($payload.results)
}

$manifestObjects = @()
$directoryPrefix = $backupDirectory.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
foreach ($row in $rows) {
  $key = [string]$row.object_key
  if ([string]::IsNullOrWhiteSpace($key) -or $key.Contains("..")) {
    throw ("Unsafe R2 object key returned from D1: " + $key)
  }
  $relative = $key -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $target = [System.IO.Path]::GetFullPath((Join-Path $backupDirectory $relative))
  if (-not $target.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw ("R2 object path escapes the backup directory: " + $key)
  }
  New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($target)) | Out-Null
  & npx wrangler r2 object get ($Bucket + "/" + $key) --remote --file $target
  if ($LASTEXITCODE -ne 0) {
    throw ("R2 download failed for object: " + $key)
  }
  $manifestObjects += [ordered]@{ key = $key; mimeType = [string]$row.mime_type; file = $relative }
}

$manifestPath = Join-Path $backupDirectory "manifest.json"
[ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  bucket = $Bucket
  database = $Database
  objectCount = $manifestObjects.Count
  objects = $manifestObjects
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Output ("R2 backup written to " + $backupDirectory)
Write-Output ("Objects downloaded: " + $manifestObjects.Count)
