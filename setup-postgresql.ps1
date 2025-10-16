#!/usr/bin/env powershell
# PostgreSQL Setup Script for PoolVisual
# Run this after installing PostgreSQL

Write-Host "=== PoolVisual PostgreSQL Setup ===" -ForegroundColor Green

# Check if PostgreSQL is installed
$pgPath = "C:\Program Files\PostgreSQL"
if (-not (Test-Path $pgPath)) {
    Write-Host "❌ PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    Write-Host "Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL found at: $pgPath" -ForegroundColor Green

# Find the latest PostgreSQL version
$versions = Get-ChildItem $pgPath | Where-Object { $_.Name -match "^\d+$" } | Sort-Object Name -Descending
if ($versions.Count -eq 0) {
    Write-Host "❌ No PostgreSQL versions found" -ForegroundColor Red
    exit 1
}

$latestVersion = $versions[0].Name
$psqlPath = "$pgPath\$latestVersion\bin\psql.exe"

if (-not (Test-Path $psqlPath)) {
    Write-Host "❌ psql.exe not found at: $psqlPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found PostgreSQL version: $latestVersion" -ForegroundColor Green

# Prompt for password
$password = Read-Host "Enter PostgreSQL 'postgres' user password"

# Test connection
Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
$env:PGPASSWORD = $password
$testResult = & $psqlPath -U postgres -h localhost -p 5432 -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL connection successful!" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL connection failed:" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    exit 1
}

# Create database
Write-Host "Creating 'poolvisual' database..." -ForegroundColor Yellow
$createDbResult = & $psqlPath -U postgres -h localhost -p 5432 -c "CREATE DATABASE poolvisual;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database 'poolvisual' created successfully!" -ForegroundColor Green
} else {
    if ($createDbResult -match "already exists") {
        Write-Host "✅ Database 'poolvisual' already exists!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create database:" -ForegroundColor Red
        Write-Host $createDbResult -ForegroundColor Red
        exit 1
    }
}

# Create .env file
Write-Host "Creating .env file..." -ForegroundColor Yellow
$envContent = @"
# Database
DATABASE_URL=postgresql://postgres:$password@localhost:5432/poolvisual

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
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8
Write-Host "✅ .env file created successfully!" -ForegroundColor Green

# Run database migrations
Write-Host "Running database migrations..." -ForegroundColor Yellow
npm run db:push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database migrations completed!" -ForegroundColor Green
} else {
    Write-Host "❌ Database migrations failed. You may need to run them manually." -ForegroundColor Red
}

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "You can now run: npm run dev" -ForegroundColor Yellow
Write-Host "Your database is ready at: postgresql://postgres:***@localhost:5432/poolvisual" -ForegroundColor Cyan
