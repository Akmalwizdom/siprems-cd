# Data Display Verification Guide

## Issues Fixed

### 1. Database Schema Mismatch
**Problem**: The database was using an old schema that didn't match the seeder script.
**Solution**: Recreated the database with the correct schema from init.sql.

### 2. Empty Database
**Problem**: No data was seeded into the database after initialization.
**Solution**: Ran the seeder script to populate 30 products, 11,432 transactions, and 18 calendar events.

### 3. Date Range Issue
**Problem**: Seeder was generating old historical data (starting Dec 2024) that didn't match the "last 30 days" queries in the API.
**Solution**: Updated seeder to generate data ending ~7 days ago (May 17, 2025 - Nov 15, 2025), ensuring recent data is available.

## Current Data Status

✅ **Products**: 30 items across 6 categories (Coffee, Tea, Non-Coffee, Pastry, Light Meals, Seasonal)
✅ **Transactions**: 11,432 transactions (~62.5/day) with realistic patterns
✅ **Calendar Events**: 18 events spread across the date range
✅ **API Endpoints**: All working and returning data

## Verification Steps

### 1. Check Backend APIs (from terminal):
```bash
# Test products endpoint
curl.exe http://localhost:8000/api/products

# Test calendar events endpoint
curl.exe http://localhost:8000/api/calendar/events

# Test dashboard metrics endpoint
curl.exe http://localhost:8000/api/dashboard/metrics

# Test sales chart endpoint
curl.exe http://localhost:8000/api/dashboard/sales-chart

# Test category sales endpoint
curl.exe http://localhost:8000/api/dashboard/category-sales
```

### 2. Open Frontend in Browser:
1. Navigate to http://localhost:3000
2. **IMPORTANT**: Hard refresh the browser to clear cache:
   - Chrome/Edge: Ctrl + Shift + R or Ctrl + F5
   - Firefox: Ctrl + Shift + R or Ctrl + F5
   
### 3. Check Each Page:

#### Dashboard Page:
- Should show Total Revenue: ~$22,090.50
- Should show Total Transactions: ~1,555
- Should show Total Items Sold: ~4,390
- Sales chart should display data from August to November
- Category sales pie chart should show 6 categories

#### Transaction Page:
- Should display 30 products in a grid
- Categories: Coffee, Tea, Non-Coffee, Pastry, Light Meals, Seasonal
- Each product should show name, price, and stock level
- Category filters should be dynamically generated

#### Calendar Page:
- Should show 18 events spread throughout the timeline
- Event types: promotion, holiday, event, store-closed
- Events should have titles, dates, and descriptions

## Troubleshooting

### If data still doesn't appear:

1. **Check Browser Console** (F12):
   - Look for JavaScript errors
   - Check Network tab for failed API requests
   - Look for CORS errors

2. **Verify Containers Are Running**:
   ```bash
   docker ps
   ```
   Should show 3 containers: frontend, backend, db

3. **Check Backend Logs**:
   ```bash
   docker logs sipremss-backend-1 --tail 50
   ```
   Look for error messages

4. **Check Frontend Logs**:
   ```bash
   docker logs sipremss-frontend-1 --tail 50
   ```
   Look for build or runtime errors

5. **Restart All Services**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```
   Wait 10 seconds for services to start, then refresh browser

6. **Verify Database Has Data**:
   ```bash
   docker exec sipremss-db-1 psql -U user -d siprems_db -c "SELECT COUNT(*) FROM products;"
   docker exec sipremss-db-1 psql -U user -d siprems_db -c "SELECT COUNT(*) FROM transactions;"
   docker exec sipremss-db-1 psql -U user -d siprems_db -c "SELECT COUNT(*) FROM calendar_events;"
   ```

7. **Test API from Browser**:
   - Open http://localhost:8000/api/products directly in browser
   - Should see JSON data for all products
   - If you see data here but not in the app, the issue is in the frontend

8. **Clear Browser Cache Completely**:
   - Chrome: Settings > Privacy and Security > Clear Browsing Data
   - Select "Cached images and files"
   - Click "Clear data"
   - Restart browser

## Sample Data Overview

### Products (30 total):
- **Coffee** (10): Heritage Espresso, Midnight Americano, Caramel Cloud Latte, etc.
- **Tea** (5): Jasmine Green Tea, Earl Grey Creme, Masala Chai Latte, etc.
- **Non-Coffee** (5): Dark Chocolate Frappe, Tropical Sunrise Smoothie, etc.
- **Pastry** (5): Butter Croissant, Almond Twice-Baked, etc.
- **Light Meals** (3): Truffle Mushroom Toast, Smoked Chicken Sandwich, etc.
- **Seasonal** (2): Pandan Coconut Latte, Strawberry Cheesecake Frappe

### Calendar Events (18 total):
- Seasonal Menu Launch
- Weekend Jazz Night
- Payday Treat Promo
- Happy Hour Special
- Cold Drink Festival
- Valentine Celebration
- Equipment Maintenance
- And more...

### Date Range:
- **Historical Data**: May 17, 2025 - November 15, 2025 (183 days)
- **Future Events**: November 25, 2025 and December 10, 2025

## Expected API Response Examples

### Dashboard Metrics:
```json
{
  "totalRevenue": 22090.5,
  "totalTransactions": 1555,
  "totalItemsSold": 4390,
  "revenueChange": -19.0,
  "transactionsChange": -18.1,
  "itemsChange": -18.1
}
```

### Category Sales:
```json
[
  {"category": "Coffee", "value": 27297.5, "color": "#4f46e5"},
  {"category": "Light Meals", "value": 17146.9, "color": "#10b981"},
  {"category": "Pastry", "value": 10982.1, "color": "#fde047"},
  ...
]
```

## Contact Information

If data still doesn't appear after following all troubleshooting steps:
1. Check browser console for specific error messages
2. Verify all Docker containers are running and healthy
3. Check that ports 3000 (frontend) and 8000 (backend) are not blocked by firewall
4. Try accessing http://localhost:8000/api/products directly in browser to confirm backend is accessible
