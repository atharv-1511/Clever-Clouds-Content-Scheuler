$base = 'https://raw.githubusercontent.com/atharv-1511/Clever-Clouds-Content-Scheuler/main'
$workspace = 'c:\Users\Atharv Raskar\Desktop\Clever Clouds Content Scheduler'

$files = @(
  '.env.example',
  '.gitignore',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'DEPLOYMENT-STATUS.md',
  'README.md',
  'components.json',
  'next.config.ts',
  'package.json',
  'pnpm-workspace.yaml',
  'postcss.config.mjs',
  'tsconfig.json',
  'vercel.json',
  'app/page.tsx',
  'app/layout.tsx',
  'app/globals.css',
  'app/login.tsx',
  'app/scheduler.tsx',
  'app/editor.tsx',
  'app/inbox.tsx',
  'app/integrations.tsx',
  'app/chatgpt-auth.ts',
  'app/api/auth/route.ts',
  'app/api/accounts/route.ts',
  'app/api/connect/[provider]/route.ts',
  'app/api/inbox/route.ts',
  'app/api/integrations/route.ts',
  'app/api/media/route.ts',
  'app/api/oauth/[provider]/route.ts',
  'app/api/posts/route.ts',
  'app/api/publish/route.ts',
  'lib/catalog.ts',
  'lib/client.ts',
  'lib/oauth.ts',
  'lib/server.ts',
  'lib/supabase.ts',
  'lib/utils.ts',
  'hooks/use-mobile.ts',
  'supabase/schema.sql',
  'scripts/migrate.mjs',
  'scripts/check-api.mjs'
)

foreach ($f in $files) {
  $localPath = Join-Path $workspace $f
  $dir = Split-Path $localPath
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $encodedF = $f.Replace('[', '%5B').Replace(']', '%5D')
  $url = "$base/$encodedF"
  try {
    Invoke-WebRequest -Uri $url -OutFile $localPath -UseBasicParsing
    Write-Host "OK: $f"
  } catch {
    Write-Host "FAIL: $f - $($_.Exception.Message)"
  }
}
Write-Host 'Done!'
