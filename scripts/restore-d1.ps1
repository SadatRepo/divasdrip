param(
  [Parameter(Mandatory = $true)]
  [string]$File,
  [switch]$Remote,
  [switch]$ConfirmRestore
)

if (-not $ConfirmRestore) {
  throw "Restore is destructive. Re-run with -ConfirmRestore after verifying the target database and SQL file."
}

$sqlFile = [System.IO.Path]::GetFullPath($File)
if (-not (Test-Path -LiteralPath $sqlFile -PathType Leaf)) {
  throw ("Backup file not found: " + $sqlFile)
}

$scope = if ($Remote) { "--remote" } else { "--local" }
npx wrangler d1 execute my-store-db $scope --file $sqlFile --yes
if ($LASTEXITCODE -ne 0) {
  throw "D1 restore failed."
}

Write-Output ("D1 restore completed from " + $sqlFile)
