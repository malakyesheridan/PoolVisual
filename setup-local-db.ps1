#!/usr/bin/env powershell
# Local PostgreSQL Setup Script for PoolVisual Development
# This creates a local database when Supabase is not available

Write-Host "=== PoolVisual Local Database Setup ===" -ForegroundColor Green
Write-Host "Setting up local PostgreSQL database for development..." -ForegroundColor Cyan

# Check if PostgreSQL is installed
$pgInstalled = Get-Command psql -ErrorAction SilentlyContinue
if (-not $pgInstalled) {
    Write-Host "❌ PostgreSQL is not installed. Please install PostgreSQL first:" -ForegroundColor Red
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Or use: winget install PostgreSQL.PostgreSQL" -ForegroundColor White
    Write-Host "3. Or use: choco install postgresql" -ForegroundColor White
    exit 1
}

Write-Host "✅ PostgreSQL found" -ForegroundColor Green

# Database configuration
$dbName = "poolvisual_dev"
$dbUser = "poolvisual_user"
$dbPassword = "poolvisual_pass_2024"

Write-Host "`nStep 1: Creating database and user..." -ForegroundColor Yellow

# Create database and user
$createDbScript = @"
-- Create user and database
CREATE USER $dbUser WITH PASSWORD '$dbPassword';
CREATE DATABASE $dbName OWNER $dbUser;
GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;
"@

try {
    psql -U postgres -c $createDbScript
    Write-Host "✅ Database and user created successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Database might already exist, continuing..." -ForegroundColor Yellow
}

Write-Host "`nStep 2: Applying schema..." -ForegroundColor Yellow

# Apply the initial schema
$schemaFile = "migrations/001_initial.sql"
if (Test-Path $schemaFile) {
    try {
        psql -U $dbUser -d $dbName -f $schemaFile
        Write-Host "✅ Initial schema applied successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to apply schema: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Schema file not found: $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Applying RLS policies..." -ForegroundColor Yellow

# Apply RLS policies
$rlsFile = "migrations/002_rls_policies.sql"
if (Test-Path $rlsFile) {
    try {
        psql -U $dbUser -d $dbName -f $rlsFile
        Write-Host "✅ RLS policies applied successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  RLS policies failed to apply: $_" -ForegroundColor Yellow
        Write-Host "This is expected if policies already exist" -ForegroundColor White
    }
} else {
    Write-Host "⚠️  RLS policies file not found: $rlsFile" -ForegroundColor Yellow
}

Write-Host "`nStep 4: Updating .env file..." -ForegroundColor Yellow

# Update .env file with local database
$localDbUrl = "postgresql://$dbUser`:$dbPassword@localhost:5432/$dbName"
$envContent = @"
# Local Development Database
DATABASE_URL=$localDbUrl

# Supabase Configuration (for when Supabase is available)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Security
SESSION_SECRET=poolvisual-local-dev-session-secret-32-chars-minimum
JWT_SECRET=poolvisual-local-dev-jwt-secret-key

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

# Development Mode
PV_REQUIRE_DB=false
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ .env file updated with local database configuration" -ForegroundColor Green

Write-Host "`nStep 5: Testing connection..." -ForegroundColor Yellow

# Test the connection
try {
    $testQuery = "SELECT version();"
    $result = psql -U $dbUser -d $dbName -c $testQuery -t
    Write-Host "✅ Database connection test successful" -ForegroundColor Green
    Write-Host "Database version: $($result.Trim())" -ForegroundColor White
} catch {
    Write-Host "❌ Database connection test failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Local database setup complete!" -ForegroundColor Green
Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
Write-Host "`nDatabase Details:" -ForegroundColor Yellow
Write-Host "  Host: localhost" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Database: $dbName" -ForegroundColor White
Write-Host "  User: $dbUser" -ForegroundColor White
Write-Host "  Password: $dbPassword" -ForegroundColor White
