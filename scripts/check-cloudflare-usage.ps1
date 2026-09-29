param(
  [Parameter(Mandatory = $true)]
  [string]$AccountTag,

  [Parameter(Mandatory = $true)]
  [string]$ApiToken,

  [string]$WorkerScriptName = "my-store",
  [string]$DatabaseId = "",
  [string]$BucketName = "my-store-images",
  [datetime]$Date = (Get-Date).ToUniversalTime().Date
)

$ErrorActionPreference = "Stop"
$graphqlEndpoint = "https://api.cloudflare.com/client/v4/graphql"
$dayStart = $Date.ToUniversalTime().ToString("yyyy-MM-ddT00:00:00.000Z")
$dayEnd = $Date.ToUniversalTime().AddDays(1).ToString("yyyy-MM-ddT00:00:00.000Z")
$monthStart = [datetime]::new($Date.Year, $Date.Month, 1, 0, 0, 0, [DateTimeKind]::Utc).ToString("yyyy-MM-ddT00:00:00.000Z")
$now = $Date.ToUniversalTime().ToString("yyyy-MM-ddT23:59:59.999Z")

function Invoke-CloudflareGraphQL {
  param(
    [Parameter(Mandatory = $true)][string]$Query,
    [Parameter(Mandatory = $true)][hashtable]$Variables
  )

  $payload = @{ query = $Query; variables = $Variables } | ConvertTo-Json -Depth 10
  $response = Invoke-RestMethod -Uri $graphqlEndpoint -Method Post -Headers @{
    Authorization = "Bearer $ApiToken"
    Accept = "application/json"
  } -ContentType "application/json" -Body $payload
  if ($response.errors) {
    throw ("Cloudflare GraphQL error: " + (($response.errors | ConvertTo-Json -Compress -Depth 10)))
  }
  return $response.data
}

$workerQuery = @'
query WorkerUsage($accountTag: string!, $start: string!, $end: string!, $scriptName: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 10000, filter: {
        scriptName: $scriptName
        datetime_geq: $start
        datetime_leq: $end
      }) {
        sum { requests errors subrequests }
      }
    }
  }
}
'@
$workerData = Invoke-CloudflareGraphQL -Query $workerQuery -Variables @{
  accountTag = $AccountTag
  start = $dayStart
  end = $dayEnd
  scriptName = $WorkerScriptName
}
$workerGroups = @($workerData.viewer.accounts[0].workersInvocationsAdaptive)
$workerRequests = [long](($workerGroups | ForEach-Object { [long]($_.sum.requests) } | Measure-Object -Sum).Sum)
$workerErrors = [long](($workerGroups | ForEach-Object { [long]($_.sum.errors) } | Measure-Object -Sum).Sum)
$workerSubrequests = [long](($workerGroups | ForEach-Object { [long]($_.sum.subrequests) } | Measure-Object -Sum).Sum)

$d1Result = $null
if ($DatabaseId) {
  $d1Query = @'
query D1Usage($accountTag: string!, $start: Date!, $end: Date!, $databaseId: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: {
        date_geq: $start
        date_leq: $end
        databaseId: $databaseId
      }) {
        sum { rowsRead rowsWritten }
        max { databaseSizeBytes }
      }
    }
  }
}
'@
  $d1Data = Invoke-CloudflareGraphQL -Query $d1Query -Variables @{
    accountTag = $AccountTag
    start = $Date.ToUniversalTime().ToString("yyyy-MM-dd")
    end = $Date.ToUniversalTime().ToString("yyyy-MM-dd")
    databaseId = $DatabaseId
  }
  $d1Groups = @($d1Data.viewer.accounts[0].d1AnalyticsAdaptiveGroups)
  $d1Result = [ordered]@{
    rowsRead = [long](($d1Groups | ForEach-Object { [long]($_.sum.rowsRead) } | Measure-Object -Sum).Sum)
    rowsWritten = [long](($d1Groups | ForEach-Object { [long]($_.sum.rowsWritten) } | Measure-Object -Sum).Sum)
    databaseSizeBytes = [long](($d1Groups | ForEach-Object { [long]($_.max.databaseSizeBytes) } | Measure-Object -Maximum).Maximum)
    freeDailyRowsRead = 5000000
    freeDailyRowsWritten = 100000
    freeStorageBytes = 5GB
  }
}

$r2Query = @'
query R2Usage($accountTag: string!, $start: Time!, $end: Time!, $bucketName: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2OperationsAdaptiveGroups(limit: 10000, filter: {
        datetime_geq: $start
        datetime_leq: $end
        bucketName: $bucketName
      }) {
        sum { requests }
        dimensions { actionType }
      }
      r2StorageAdaptiveGroups(limit: 10000, filter: {
        datetime_geq: $start
        datetime_leq: $end
        bucketName: $bucketName
      }, orderBy: [datetime_DESC]) {
        max { payloadSize metadataSize objectCount }
        dimensions { datetime }
      }
    }
  }
}
'@
$r2Data = Invoke-CloudflareGraphQL -Query $r2Query -Variables @{
  accountTag = $AccountTag
  start = $monthStart
  end = $now
  bucketName = $BucketName
}
$r2Account = $r2Data.viewer.accounts[0]
$r2OperationGroups = @($r2Account.r2OperationsAdaptiveGroups)
$r2Operations = [ordered]@{
  total = [long](($r2OperationGroups | ForEach-Object { [long]($_.sum.requests) } | Measure-Object -Sum).Sum)
  byAction = @($r2OperationGroups | ForEach-Object { [pscustomobject]@{ action = $_.dimensions.actionType; requests = [long]$_.sum.requests } })
  freeMonthlyClassA = 1000000
  freeMonthlyClassB = 10000000
}
$r2StorageGroups = @($r2Account.r2StorageAdaptiveGroups)
$r2Storage = [ordered]@{
  payloadBytes = [long](($r2StorageGroups | ForEach-Object { [long]($_.max.payloadSize) } | Measure-Object -Maximum).Maximum)
  metadataBytes = [long](($r2StorageGroups | ForEach-Object { [long]($_.max.metadataSize) } | Measure-Object -Maximum).Maximum)
  objectCount = [long](($r2StorageGroups | ForEach-Object { [long]($_.max.objectCount) } | Measure-Object -Maximum).Maximum)
  freeMonthlyStorageBytes = 10GB
}

$result = [ordered]@{
  checkedDateUtc = $Date.ToUniversalTime().ToString("yyyy-MM-dd")
  windows = [ordered]@{ workerAndD1 = "$dayStart to $dayEnd"; r2 = "$monthStart to $now" }
  worker = [ordered]@{
    requests = $workerRequests
    errors = $workerErrors
    subrequests = $workerSubrequests
    freeDailyRequests = 100000
  }
  d1 = $d1Result
  r2 = [ordered]@{ operations = $r2Operations; storage = $r2Storage }
}
$result | ConvertTo-Json -Depth 12
