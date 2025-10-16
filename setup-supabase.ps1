#!/usr/bin/env powershell
# Supabase Setup Script for PoolVisual
# This is much easier than local PostgreSQL!

Write-Host "=== PoolVisual Supabase Setup ===" -ForegroundColor Green
Write-Host "This will set up a cloud PostgreSQL database in 5 minutes!" -ForegroundColor Cyan

Write-Host "`nStep 1: Create Supabase Account" -ForegroundColor Yellow
Write-Host "1. Go to: https://supabase.com" -ForegroundColor White
Write-Host "2. Click 'Start your project'" -ForegroundColor White
Write-Host "3. Sign up with GitHub (recommended)" -ForegroundColor White
Write-Host "4. Create a new project" -ForegroundColor White
Write-Host "5. Choose a name like 'poolvisual-dev'" -ForegroundColor White
Write-Host "6. Set a strong database password (save it!)" -ForegroundColor White
Write-Host "7. Choose region closest to you" -ForegroundColor White

Write-Host "`nStep 2: Get Your Connection Details" -ForegroundColor Yellow
Write-Host "1. In your Supabase dashboard, go to Settings > Database" -ForegroundColor White
Write-Host "2. Copy the 'Connection string' (URI)" -ForegroundColor White
Write-Host "3. It will look like: postgresql://postgres:[password]@[host]:5432/postgres" -ForegroundColor White

Write-Host "`nPress Enter when you have your connection string..." -ForegroundColor Cyan
Read-Host

# Get connection details
$connectionString = Read-Host "Paste your Supabase connection string here"
if (-not $connectionString -or $connectionString -notmatch "postgresql://") {
    Write-Host "❌ Invalid connection string. Please try again." -ForegroundColor Red
    exit 1
}

# Extract password from connection string for testing
if ($connectionString -match "postgresql://postgres:([^@]+)@") {
    $password = $matches[1]
} else {
    Write-Host "❌ Could not extract password from connection string." -ForegroundColor Red
    exit 1
}

# Test connection
Write-Host "`nStep 3: Testing Connection..." -ForegroundColor Yellow
Write-Host "Testing connection to Supabase..." -ForegroundColor White

# Install psql if not available (using chocolatey or direct download)
$psqlPath = $null
$possiblePaths = @(
    "C:\Program Files\PostgreSQL\*\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe",
    "psql.exe"
)

foreach ($path in $possiblePaths) {
    if ($path -like "*\*") {
        $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $psqlPath = $found.FullName
            break
        }
    } else {
        $found = Get-Command $path -ErrorAction SilentlyContinue
        if ($found) {
            $psqlPath = $found.Source
            break
        }
    }
}

if (-not $psqlPath) {
    Write-Host "⚠️  psql not found. Installing PostgreSQL client..." -ForegroundColor Yellow
    
    # Try to install via winget
    try {
        winget install PostgreSQL.PostgreSQL --silent --accept-package-agreements --accept-source-agreements
        Start-Sleep -Seconds 10
        $psqlPath = "C:\Program Files\PostgreSQL\*\bin\psql.exe"
        $found = Get-ChildItem $psqlPath -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $psqlPath = $found.FullName
        }
    } catch {
        Write-Host "❌ Could not install PostgreSQL client automatically." -ForegroundColor Red
        Write-Host "Please install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
        Write-Host "Or use the Supabase dashboard to run SQL commands." -ForegroundColor Yellow
        $psqlPath = $null
    }
}

if ($psqlPath) {
    Write-Host "Testing connection with psql..." -ForegroundColor White
    $env:PGPASSWORD = $password
    
    # Extract host from connection string
    $hostPart = ($connectionString -split '@')[1]
    $host = ($hostPart -split ':')[0]
    
    $testResult = & $psqlPath -U postgres -h $host -p 5432 -d postgres -c "SELECT version();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connection successful!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Connection test failed, but continuing..." -ForegroundColor Yellow
        Write-Host "You can test the connection later in the Supabase dashboard." -ForegroundColor White
    }
} else {
    Write-Host "⚠️  Skipping connection test (psql not available)" -ForegroundColor Yellow
}

# Create .env file
Write-Host "`nStep 4: Creating .env file..." -ForegroundColor Yellow
$envContent = @"
# Database (Supabase)
DATABASE_URL=$connectionString

# JWT Secret (generate a secure random string)
JWT_SECRET=poolvisual-jwt-secret-$(Get-Random -Minimum 100000 -Maximum 999999)

# Server Configuration
NODE_ENV=development
PORT=5000

# Application URLs
APP_BASE_URL=http://localhost:5000
API_BASE_URL=http://localhost:5000/api

# Default Business Settings
DEFAULT_CURRENCY=AUD
DEFAULT_TAX_RATE=0.10
DEFAULT_DEPOSIT_PERCENTAGE=0.30

# Security
SESSION_SECRET=poolvisual-session-$(Get-Random -Minimum 100000 -Maximum 999999)

# Supabase (optional - for future features)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ .env file created successfully!" -ForegroundColor Green

# Run database migrations
Write-Host "`nStep 5: Setting up database schema..." -ForegroundColor Yellow
Write-Host "Running database migrations..." -ForegroundColor White

npm run db:push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database schema created successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Migration failed. You may need to run them manually." -ForegroundColor Yellow
    Write-Host "You can run SQL commands in the Supabase dashboard:" -ForegroundColor White
    Write-Host "1. Go to your Supabase project dashboard" -ForegroundColor White
    Write-Host "2. Click 'SQL Editor'" -ForegroundColor White
    Write-Host "3. Copy and paste the contents of migrations/001_initial.sql" -ForegroundColor White
    Write-Host "4. Click 'Run'" -ForegroundColor White
}

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "🎉 Your Supabase database is ready!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run dev" -ForegroundColor White
Write-Host "2. Open: http://localhost:5000" -ForegroundColor White
Write-Host "3. Re-add your 2 test materials" -ForegroundColor White
Write-Host "`nYour database dashboard: https://supabase.com/dashboard" -ForegroundColor Cyan
Write-Host "Connection string saved in .env file" -ForegroundColor Gray
