@echo off
echo ========================================
echo SIPREMS Data Verification
echo ========================================
echo.

echo 1. Checking Docker Containers...
docker ps --filter "name=sipremss" --format "   - {{.Names}}: {{.Status}}"
echo.

echo 2. Checking Database Data...
echo    Products:
docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM products;"
echo    Transactions:
docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM transactions;"
echo    Calendar Events:
docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM calendar_events;"
echo.

echo 3. Checking Recent Transactions (last 30 days)...
docker exec sipremss-db-1 psql -U user -d siprems_db -t -c "SELECT COUNT(*) FROM transactions WHERE date >= NOW() - INTERVAL '30 days';"
echo.

echo 4. Testing API Endpoints...
echo    Testing /api/products...
curl.exe -s http://localhost:8000/api/products > nul && echo    OK || echo    FAILED
echo    Testing /api/calendar/events...
curl.exe -s http://localhost:8000/api/calendar/events > nul && echo    OK || echo    FAILED
echo    Testing /api/dashboard/metrics...
curl.exe -s http://localhost:8000/api/dashboard/metrics > nul && echo    OK || echo    FAILED
echo    Testing /api/dashboard/sales-chart...
curl.exe -s http://localhost:8000/api/dashboard/sales-chart > nul && echo    OK || echo    FAILED
echo    Testing /api/dashboard/category-sales...
curl.exe -s http://localhost:8000/api/dashboard/category-sales > nul && echo    OK || echo    FAILED
echo.

echo ========================================
echo Summary
echo ========================================
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000/api
echo.
echo If all checks passed, open http://localhost:3000 in your browser.
echo Remember to hard refresh (Ctrl+Shift+R) to clear cache!
echo.

set /p open="Would you like to open the frontend in your browser? (Y/N): "
if /i "%open%"=="Y" start http://localhost:3000

pause
