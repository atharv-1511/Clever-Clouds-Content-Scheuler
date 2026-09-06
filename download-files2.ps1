$base = 'https://raw.githubusercontent.com/atharv-1511/Clever-Clouds-Content-Scheuler/main'
$workspace = 'c:\Users\Atharv Raskar\Desktop\Clever Clouds Content Scheduler'

# Handle bracket-named route files - download then move to correct path
$connectDir = Join-Path $workspace 'app\api\connect\[provider]'
$oauthDir = Join-Path $workspace 'app\api\oauth\[provider]'

if (!(Test-Path $connectDir)) { New-Item -ItemType Directory -Path $connectDir -Force | Out-Null }
if (!(Test-Path $oauthDir)) { New-Item -ItemType Directory -Path $oauthDir -Force | Out-Null }

# Download connect route
$url1 = "$base/app/api/connect/%5Bprovider%5D/route.ts"
Invoke-WebRequest -Uri $url1 -OutFile (Join-Path $connectDir 'route.ts') -UseBasicParsing
Write-Host "OK: app/api/connect/[provider]/route.ts"

# Download oauth route  
$url2 = "$base/app/api/oauth/%5Bprovider%5D/route.ts"
Invoke-WebRequest -Uri $url2 -OutFile (Join-Path $oauthDir 'route.ts') -UseBasicParsing
Write-Host "OK: app/api/oauth/[provider]/route.ts"

# Now download all components
$components = @(
  'accordion', 'alert-dialog', 'alert', 'aspect-ratio', 'attachment', 'avatar',
  'badge', 'breadcrumb', 'bubble', 'button-group', 'button', 'calendar', 'card',
  'carousel', 'chart', 'checkbox', 'collapsible', 'combobox', 'command',
  'context-menu', 'dialog', 'direction', 'drawer', 'dropdown-menu', 'empty',
  'field', 'hover-card', 'input-group', 'input-otp', 'input', 'item', 'kbd',
  'label', 'marker', 'menubar', 'message-scroller', 'message', 'native-select',
  'navigation-menu', 'pagination', 'popover', 'progress', 'radio-group',
  'resizable', 'scroll-area', 'select', 'separator', 'sheet', 'sidebar',
  'skeleton', 'slider', 'spinner', 'switch', 'table', 'tabs', 'textarea',
  'toast', 'toggle-group', 'toggle', 'tooltip'
)

$compDir = Join-Path $workspace 'components\ui'
if (!(Test-Path $compDir)) { New-Item -ItemType Directory -Path $compDir -Force | Out-Null }

foreach ($c in $components) {
  $url = "$base/components/ui/$c.tsx"
  $out = Join-Path $compDir "$c.tsx"
  try {
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Host "OK: components/ui/$c.tsx"
  } catch {
    Write-Host "FAIL: components/ui/$c.tsx"
  }
}

# Also fetch public images
$pubDir = Join-Path $workspace 'public'
if (!(Test-Path $pubDir)) { New-Item -ItemType Directory -Path $pubDir -Force | Out-Null }

$images = @('cc-blue.png', 'cc-white.png', 'icon.png')
foreach ($img in $images) {
  $url = "$base/public/$img"
  try {
    Invoke-WebRequest -Uri $url -OutFile (Join-Path $pubDir $img) -UseBasicParsing
    Write-Host "OK: public/$img"
  } catch {
    Write-Host "FAIL: public/$img"
  }
}

Write-Host 'All done!'
