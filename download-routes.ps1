$connectDir = 'c:\Users\Atharv Raskar\Desktop\Clever Clouds Content Scheduler\app\api\connect\[provider]'
$oauthDir = 'c:\Users\Atharv Raskar\Desktop\Clever Clouds Content Scheduler\app\api\oauth\[provider]'

New-Item -ItemType Directory -Path $connectDir -Force | Out-Null
New-Item -ItemType Directory -Path $oauthDir -Force | Out-Null

$content1 = (Invoke-WebRequest 'https://raw.githubusercontent.com/atharv-1511/Clever-Clouds-Content-Scheuler/main/app/api/connect/%5Bprovider%5D/route.ts' -UseBasicParsing).Content
Set-Content -LiteralPath (Join-Path $connectDir 'route.ts') -Value $content1 -Encoding UTF8
Write-Host 'Connect route saved'

$content2 = (Invoke-WebRequest 'https://raw.githubusercontent.com/atharv-1511/Clever-Clouds-Content-Scheuler/main/app/api/oauth/%5Bprovider%5D/route.ts' -UseBasicParsing).Content
Set-Content -LiteralPath (Join-Path $oauthDir 'route.ts') -Value $content2 -Encoding UTF8
Write-Host 'OAuth route saved'
