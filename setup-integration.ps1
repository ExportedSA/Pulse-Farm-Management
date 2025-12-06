Write-Host '=== Pulse Integration Setup ===' -ForegroundColor Cyan
Write-Host 'This will integrate Chat and Compliance into your main app' -ForegroundColor Yellow
Write-Host ''

# Create directories
Write-Host 'Creating directories...' -ForegroundColor Green
New-Item -Path 'prisma' -ItemType Directory -Force | Out-Null
New-Item -Path 'server/routes' -ItemType Directory -Force | Out-Null
New-Item -Path 'client/src/lib' -ItemType Directory -Force | Out-Null
New-Item -Path 'client/src/pages' -ItemType Directory -Force | Out-Null

# Backup existing files
Write-Host 'Backing up existing files...' -ForegroundColor Green
Copy-Item 'package.json' 'package.json.backup' -Force
Copy-Item 'server/routes.ts' 'server/routes.ts.backup' -Force
Copy-Item 'client/src/App.tsx' 'client/src/App.tsx.backup' -Force
Copy-Item 'client/src/components/AppSidebar.tsx' 'client/src/components/AppSidebar.tsx.backup' -Force

Write-Host 'Setup complete! Now run: npm install && npx prisma generate && npx prisma db push && npm run dev' -ForegroundColor Cyan
