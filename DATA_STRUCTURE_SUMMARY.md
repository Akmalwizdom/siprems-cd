# SIPREMSS Data Structure Summary

## Overview
The database has been successfully populated with smart seeded data using `seed_smart.py`. All components are now properly integrated and displaying data from the database.

## Database Population

### Seeding Results (Last Run: 2025-11-22)
- **Date Range**: 2025-05-17 to 2025-11-15 (183 days, ~6 months)
- **Products**: 30 items across 6 categories
- **Calendar Events**: 18 events (16 historical + 2 future)
- **Transactions**: 11,432 transactions (~62.5/day average)
- **Transaction Items**: 21,366 line items

## Data Structure

### 1. Products Table
- **Total**: 30 products
- **Categories**:
  - Coffee (10 products): CF-001 to CF-010
  - Tea (5 products): TE-011 to TE-015
  - Non-Coffee (5 products): NC-016 to NC-020
  - Pastry (5 products): PS-021 to PS-025
  - Light Meals (3 products): LM-026 to LM-028
  - Seasonal (2 products): SN-029 to SN-030

**Schema**:
```sql
- id (SERIAL PRIMARY KEY)
- name (VARCHAR)
- category (VARCHAR)
- sku (VARCHAR UNIQUE)
- description (TEXT)
- cost_price (DECIMAL)
- selling_price (DECIMAL)
- stock (INTEGER)
- is_seasonal (BOOLEAN)
- created_at (TIMESTAMP)
```

### 2. Transactions Table
Stores transactional data with timestamps and customer information.

**Schema**:
```sql
- id (UUID PRIMARY KEY)
- date (TIMESTAMP)
- total_amount (DECIMAL)
- payment_method (VARCHAR): Cash, QRIS, Debit Card, Credit Card, E-Wallet
- customer_segment (VARCHAR): dine-in, takeaway, delivery
- items_count (INTEGER)
- created_at (TIMESTAMP)
```

### 3. Transaction Items Table
Line items for each transaction.

**Schema**:
```sql
- id (SERIAL PRIMARY KEY)
- transaction_id (UUID FK)
- product_id (INTEGER FK)
- quantity (INTEGER)
- unit_price (DECIMAL)
- subtotal (DECIMAL)
```

### 4. Calendar Events Table
Events used as Prophet regressors.

**Schema**:
```sql
- id (SERIAL PRIMARY KEY)
- date (DATE)
- title (VARCHAR)
- type (VARCHAR): promotion, holiday, store-closed, event
- impact_weight (DECIMAL): 0.0 to 1.1
- category (VARCHAR)
- description (TEXT)
- is_all_day (BOOLEAN)
```

**Events Breakdown**:
- Promotions: 8 events
- Events: 7 events
- Holidays: 2 events
- Store Closed: 1 event

### 5. Prophet-Ready Views

#### daily_sales_summary
Main view for Prophet model training with all required regressors.

**Columns**:
- `ds` (DATE): Date column for Prophet
- `y` (DECIMAL): Target variable (daily revenue)
- `transactions_count` (INTEGER): Number of transactions
- `items_sold` (INTEGER): Total items sold
- `avg_ticket` (DECIMAL): Average transaction amount
- `day_of_week` (INTEGER): 0-6 (Sunday-Saturday)
- `is_weekend` (INTEGER): 0 or 1
- `promo_intensity` (DECIMAL): Sum of promotion impacts
- `holiday_intensity` (DECIMAL): Sum of holiday impacts
- `event_intensity` (DECIMAL): Sum of event impacts
- `closure_intensity` (DECIMAL): Sum of store-closed impacts

#### category_sales_summary
Category-level revenue aggregation for dashboard analytics.

**Columns**:
- `ds` (DATE)
- `category` (VARCHAR)
- `revenue` (DECIMAL)

#### product_daily_sales
Product-level daily performance metrics.

**Columns**:
- `product_id` (INTEGER)
- `ds` (DATE)
- `units_sold` (INTEGER)
- `revenue` (DECIMAL)

## Prophet Model Configuration

### Regressors Used
The Prophet model uses the following external regressors from `daily_sales_summary`:
1. `is_weekend`: Weekend indicator (0/1)
2. `promo_intensity`: Cumulative promotion impact (0.0-1.0+)
3. `holiday_intensity`: Cumulative holiday impact (0.0-1.1+)
4. `event_intensity`: Cumulative event impact (0.0-1.0+)
5. `closure_intensity`: Store closure impact (0.0-1.0)
6. `transactions_count`: Historical transaction count
7. `avg_ticket`: Historical average ticket size

### Prophet Parameters
```python
Prophet(
    yearly_seasonality=True,
    weekly_seasonality=True,
    daily_seasonality=False,
    changepoint_prior_scale=0.07,
    seasonality_mode="additive"
)
```

### Forecast Configuration
- **Horizon**: 84 days (12 weeks)
- **Chart Window**: 144 days (forecast + 60 days historical)
- **Training Data**: All available historical data (183 days)

## API Endpoints

### Frontend Data Sources

1. **Products** (`/api/products`)
   - Pagination: page, limit, search
   - Returns: product details with sales statistics

2. **Transactions** (`/api/transactions`)
   - Pagination: page, limit
   - Returns: transaction headers with customer info

3. **Calendar Events** (`/api/calendar/events`)
   - Returns: all events with type, impact, category, description

4. **Dashboard Metrics** (`/api/dashboard/metrics`)
   - Returns: 30-day revenue, transactions, items sold with % changes

5. **Sales Chart** (`/api/dashboard/sales-chart`)
   - Returns: 90-day daily sales and transaction counts

6. **Category Sales** (`/api/dashboard/category-sales`)
   - Returns: 90-day category revenue breakdown

7. **Prediction** (`/api/predict/{store_id}`)
   - Accepts: Optional events array for future predictions
   - Returns: Forecast chart data, recommendations, event annotations

8. **Model Training** (`/api/train/{store_id}`)
   - Trains Prophet model with current data
   - Returns: Training status and metrics

## Frontend Components

### Data Display Pages

1. **Products.tsx**
   - ✅ Fixed: Endpoint corrected to `/api/products`
   - Displays: Products with stock, pricing, sales data
   - Features: Pagination, search, filtering

2. **Transaction.tsx**
   - Displays: POS interface + transaction history
   - Features: Add to cart, checkout, pagination

3. **TransactionHistory.tsx**
   - Displays: Historical transactions
   - Features: Pagination, date formatting

4. **Calendar.tsx**
   - Displays: Events from database in month/week/day views
   - Features: Add/remove events (local only), event type filtering
   - Note: Uses StoreContext which fetches from `/api/calendar/events`

5. **SmartPrediction.tsx**
   - Displays: Prophet forecasts with confidence intervals
   - Features: Event annotations, product recommendations

6. **Dashboard.tsx**
   - Displays: Key metrics, sales charts, category breakdown
   - Features: Real-time data from aggregated views

## Data Compatibility with Prophet

### Input Data Structure ✅
The `daily_sales_summary` view provides exactly what Prophet expects:
- **ds**: Date column (required by Prophet)
- **y**: Target variable (daily revenue)
- **Regressors**: All 7 external features properly formatted

### Event Integration ✅
Calendar events are integrated into predictions via:
1. Database events loaded from `calendar_events` table
2. Optional request events passed via API
3. Events mapped to intensity regressors
4. Future dates populated with event impacts

### Forecast Output ✅
The `/api/predict/{store_id}` endpoint returns:
- Historical + predicted values
- Confidence intervals (lower, upper)
- Event annotations with titles and types
- Product recommendations based on growth factors

## Changes Made

### 1. Frontend Fixes
- **Products.tsx**: Fixed API endpoint from `/filteredProducts` to `/products`
- Removed invalid comments and unused code
- Updated placeholder text

### 2. Database Population
- Executed `seed_smart.py` successfully
- Populated all tables with realistic data
- Created 6 months of historical transactions
- Added future events for forecasting

### 3. Verification
- Tested all API endpoints
- Verified data structure compatibility
- Confirmed Prophet model requirements are met

## Testing Recommendations

1. **Frontend Testing**
   - Start the development server
   - Navigate through all pages
   - Verify data displays correctly
   - Test pagination and search features

2. **Prophet Model Testing**
   - Call `/api/train/store_1` to train the model
   - Call `/api/predict/store_1` to generate forecast
   - Verify predictions display in SmartPrediction page
   - Test with custom future events

3. **Data Integrity**
   - Verify transaction totals match in different views
   - Check that category sales sum to total sales
   - Ensure product stock reflects transaction deductions

## Next Steps

1. **Optional Enhancements**:
   - Add ability to persist calendar events to database from UI
   - Implement product image uploads
   - Add transaction item details view
   - Create admin panel for data management

2. **Model Optimization**:
   - Fine-tune Prophet hyperparameters
   - Add more granular seasonality
   - Implement cross-validation
   - Add custom holidays specific to location

3. **Production Deployment**:
   - Set up automated database backups
   - Implement proper authentication
   - Add monitoring and logging
   - Configure environment variables
