param(
  [Parameter(Mandatory = $true)]
  [string]$Manifest,
  [switch]$Remote,
  [switch]$ConfirmRestore
)

if (-not $Remote) {
  throw "Refusing to write to a remote bucket without -Remote."
}
if (-not $ConfirmRestore) {
  throw "R2 restore can overwrite objects. Re-run with -ConfirmRestore after verifying the target bucket and manifest."
}

$manifestPath = [System.IO.Path]::GetFullPath($Manifest)
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw ("Manifest not found: " + $manifestPath)
}
try {
  $payload = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
} catch {
  throw "Manifest is not valid JSON."
}
$bucket = [string]$payload.bucket
if ([string]::IsNullOrWhiteSpace($bucket)) {
  throw "Manifest does not contain a bucket name."
}

$manifestDirectory = [System.IO.Path]::GetDirectoryName($manifestPath)
$directoryPrefix = $manifestDirectory.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$count = 0
foreach ($object in @($payload.objects)) {
  $key = [string]$object.key
  $relative = [string]$object.file
  if ([string]::IsNullOrWhiteSpace($key) -or [string]::IsNullOrWhiteSpace($relative) -or $key.Contains("..") -or $relative.Contains("..")) {
    throw ("Unsafe object entry in manifest: " + $key)
  }
  $file = [System.IO.Path]::GetFullPath((Join-Path $manifestDirectory $relative))
  if (-not $file.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw ("Manifest file escapes its backup directory: " + $relative)
  }
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw ("Backup object file not found: " + $file)
  }
  $args = @("wrangler", "r2", "object", "put", ($bucket + "/" + $key), "--remote", "--file", $file, "--force")
  $mimeType = [string]$object.mimeType
  if (-not [string]::IsNullOrWhiteSpace($mimeType)) {
    $args += @("--content-type", $mimeType)
  }
  & npx @args
  if ($LASTEXITCODE -ne 0) {
    throw ("R2 restore failed for object: " + $key)
  }
  $count += 1
}

Write-Output ("R2 restore completed for " + $count + " objects into " + $bucket)
