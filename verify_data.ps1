# SIPREMS Data Verification Script
# Run this script to verify that all data is properly loaded

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SIPREMS Data Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if Docker containers are running
Write-Host "1. Checking Docker Containers..." -ForegroundColor Yellow
$containers = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "sipremss"
if ($containers) {
    Write-Host "   ✓ Containers are running:" -ForegroundColor Green
    docker ps --filter "name=sipremss" --format "   - {{.Names}}: {{.Status}}"
} else {
    Write-Host "   ✗ No SIPREMS containers running!" -ForegroundColor Red
    Write-Host "   Run: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# Check database data
Write-Host "`n2. Checking Database Data..." -ForegroundColor Yellow

Write-Host "   Products: " -NoNewline
$products = docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM products;" 2>$null
if ($products -match '\d+' -and [int]$matches[0] -gt 0) {
    Write-Host "$($matches[0]) OK" -ForegroundColor Green
} else {
    Write-Host "0 FAIL" -ForegroundColor Red
}

Write-Host "   Transactions: " -NoNewline
$transactions = docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM transactions;" 2>$null
if ($transactions -match '\d+' -and [int]$matches[0] -gt 0) {
    Write-Host "$($matches[0]) OK" -ForegroundColor Green
} else {
    Write-Host "0 FAIL" -ForegroundColor Red
}

Write-Host "   Calendar Events: " -NoNewline
$events = docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM calendar_events;" 2>$null
if ($events -match '\d+' -and [int]$matches[0] -gt 0) {
    Write-Host "$($matches[0]) OK" -ForegroundColor Green
} else {
    Write-Host "0 FAIL" -ForegroundColor Red
}

# Check recent transactions
Write-Host "`n3. Checking Recent Transactions (last 30 days)..." -ForegroundColor Yellow
$recentTxn = docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM transactions WHERE date >= NOW() - INTERVAL '30 days';" 2>$null
if ($recentTxn -match '\d+' -and [int]$matches[0] -gt 0) {
    Write-Host "   Recent transactions: $($matches[0]) OK" -ForegroundColor Green
} else {
    Write-Host "   No recent transactions found! FAIL" -ForegroundColor Red
    Write-Host "   This might cause empty dashboard. Run seeder:" -ForegroundColor Yellow
    Write-Host "   docker exec sipremss-backend-1 python seed_smart.py" -ForegroundColor Yellow
}

# Test API endpoints
Write-Host "`n4. Testing API Endpoints..." -ForegroundColor Yellow

Write-Host "   /api/products: " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/products" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $data = $response.Content | ConvertFrom-Json
        Write-Host "$($data.Count) products OK" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed FAIL" -ForegroundColor Red
}

Write-Host "   /api/calendar/events: " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/calendar/events" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $data = $response.Content | ConvertFrom-Json
        Write-Host "$($data.Count) events OK" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed FAIL" -ForegroundColor Red
}

Write-Host "   /api/dashboard/metrics: " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/dashboard/metrics" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Revenue: `$$($data.totalRevenue), Txns: $($data.totalTransactions) OK" -ForegroundColor Green
        if ($data.totalRevenue -eq 0) {
            Write-Host "   Warning: Revenue is 0. You may need to reseed data." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Failed FAIL" -ForegroundColor Red
}

Write-Host "   /api/dashboard/sales-chart: " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/dashboard/sales-chart" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $data = $response.Content | ConvertFrom-Json
        Write-Host "$($data.Count) data points OK" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed FAIL" -ForegroundColor Red
}

Write-Host "   /api/dashboard/category-sales: " -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/dashboard/category-sales" -Method GET -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $data = $response.Content | ConvertFrom-Json
        Write-Host "$($data.Count) categories OK" -ForegroundColor Green
    }
} catch {
    Write-Host "Failed FAIL" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000/api" -ForegroundColor White
Write-Host "`nIf all checks passed (OK), open http://localhost:3000 in your browser." -ForegroundColor Green
Write-Host "Remember to hard refresh (Ctrl+Shift+R) to clear cache!`n" -ForegroundColor Yellow

# Offer to open browser
$open = Read-Host "Would you like to open the frontend in your browser? (Y/N)"
if ($open -eq 'Y' -or $open -eq 'y') {
    Start-Process "http://localhost:3000"
}
