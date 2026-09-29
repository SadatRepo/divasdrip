param(
  [switch]$Remote,
  [string]$OutputDirectory = "backups"
)

if (-not $Remote) {
  throw "Refusing to create a local-only backup by default. Re-run with -Remote for the deployment database or remove this guard for a local backup."
}

$root = (Get-Location).Path
$directory = [System.IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $directory ("my-store-db-" + $stamp + ".sql")

npx wrangler d1 export my-store-db --remote --output $output --skip-confirmation
if ($LASTEXITCODE -ne 0) {
  throw "D1 export failed."
}

Write-Output ("D1 backup written to " + $output)
