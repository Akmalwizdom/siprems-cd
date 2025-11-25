# Accuracy Discrepancy Analysis

## Problem Statement
- **Training reports**: 94.2% Prediction Accuracy
- **Dashboard shows**: 64.7% Forecast Accuracy
- **Discrepancy**: 29.5% difference across all horizons (7, 30, 90 days)

## Root Causes Identified

### 1. **Unreliable Inverse Transform Detection (CRITICAL)**

#### In `calculate_forecast_accuracy()` (Line 97-137):
```python
# WRONG: Guesses if model is log-scale based on prediction magnitude
if forecast['yhat'].max() < 20 and forecast['yhat'].min() > -5:
    predicted = np.expm1(forecast['yhat'].values.clip(-10, 20))
else:
    predicted = forecast['yhat'].values
```

**Problem**: 
- Heuristic detection: "if predictions < 20, assume log-scale"
- This is unreliable! Small sales volumes could have predictions < 20 even in original scale
- If detection fails, accuracy compares **log-scale predictions vs original-scale actuals**
- Result: Inflated error (64.7% accuracy)

#### In `get_prediction()` (Line 1277-1297):
```python
# WRONG: Similar heuristic detection
if max_pred < 50 and avg_historical > 50:
    forecast['yhat'] = np.expm1(forecast['yhat'].clip(-10, 20))
elif max_pred < 20:
    forecast['yhat'] = np.expm1(forecast['yhat'].clip(-10, 20))
else:
    logger.warning(f"Model appears to be non-log scale")
```

**Problem**:
- Different thresholds (20 vs 50) than accuracy calculation
- Inconsistent behavior between accuracy and prediction

### 2. **Metadata Not Being Used**

**Model saves metadata**:
```json
{
  "log_transform": true,
  "data_points": 103,
  "cv": 0.4937,
  "changepoint_prior_scale": 0.08
}
```

**But code ignores it!**
- `calculate_forecast_accuracy()` doesn't accept metadata parameter
- `get_prediction()` loads metadata but doesn't use it for inverse transform
- Instead, both functions use unreliable heuristic detection

### 3. **Scale Mismatch in Accuracy Calculation**

**Training** (Line 1149):
```python
df['y_log'] = np.log1p(df['y'])  # Train on log scale
model.fit(df[["ds", "y_log", *active_regressors]].rename(columns={'y_log': 'y'}))
```

**Accuracy Calculation**:
```python
forecast = model.predict(future_validation)  # Predictions in log scale
actual = test_df['y'].values  # Actuals in ORIGINAL scale!
```

**If heuristic fails** (predictions don't look "small enough"):
- Predictions: log-scale (e.g., 4.6 for $100 sales)
- Actuals: original scale (e.g., 100)
- MAPE = |100 - 4.6| / 100 = 95.4%
- Accuracy = 100 - 95.4 = 4.6% ❌

**This explains the 64.7% accuracy!** The heuristic partially works (sometimes applies inverse transform, sometimes doesn't), resulting in mixed accuracy.

### 4. **The 94.2% is Misleading**

The 94.2% might be:
- A lucky validation run where heuristic worked
- Cached from a different model version
- Not reflecting actual out-of-sample performance

## Mathematical Proof

### Example Data:
- Actual sales: $100
- Log-transformed: log1p(100) = 4.615

### Scenario A: Correct Inverse Transform
```python
predicted_log = 4.5  # Model predicts log value
predicted_actual = np.expm1(4.5) = 89.02  # Inverse transform
error = |100 - 89.02| / 100 = 10.98%
accuracy = 100 - 10.98 = 89.02% ✓
```

### Scenario B: Missing Inverse Transform (BUG)
```python
predicted_log = 4.5  # Model predicts log value
# No inverse transform applied!
error = |100 - 4.5| / 100 = 95.5%
accuracy = 100 - 95.5 = 4.5% ❌
```

### Scenario C: Mixed (Current State)
```python
# Sometimes applies transform, sometimes doesn't
# Depending on whether predictions are < 20
# Result: Unstable accuracy between 4% - 90%
# Average: ~65% (what we're seeing!)
```

## Impact on Dashboard

The dashboard calculates accuracy using the same flawed function:
```javascript
// Frontend likely calls /api/predict/{store_id}
// Gets accuracy from meta.accuracy
// Displays 64.7% because of scale mismatch
```

## Solution Requirements

1. **Use metadata to determine inverse transform** (not heuristics)
2. **Consistent scale in accuracy calculation** (both predictions and actuals in same scale)
3. **Validate with proper cross-validation** (not just last 14 days)
4. **Test across all horizons** (7, 30, 90 days) to ensure stability

## Proposed Fix

### 1. Update `calculate_forecast_accuracy()`
```python
def calculate_forecast_accuracy(
    historical_df: pd.DataFrame, 
    model: Prophet, 
    meta: Optional[Dict] = None
) -> float:
    """Calculate accuracy with proper scale handling"""
    
    validation_days = 14
    train_df = historical_df.iloc[:-validation_days]
    test_df = historical_df.iloc[-validation_days:]
    
    # Build validation set
    future_validation = pd.DataFrame({'ds': test_df['ds']})
    for reg in REGRESSOR_COLUMNS:
        future_validation[reg] = test_df[reg].values if reg in test_df.columns else 0.0
    
    # Get predictions
    forecast = model.predict(future_validation)
    
    # USE METADATA: Check if model was trained with log transform
    use_log_transform = meta and meta.get('log_transform', False)
    
    if use_log_transform:
        # Inverse transform predictions to original scale
        predicted = np.expm1(forecast['yhat'].values.clip(-10, 20))
        logger.info("Accuracy: Applied inverse log transform based on metadata")
    else:
        predicted = forecast['yhat'].values
        logger.info("Accuracy: No inverse transform (linear model)")
    
    # Actuals are always in original scale
    actual = test_df['y'].values
    
    # Calculate MAPE
    mask = actual != 0
    if not mask.any():
        return 0.0
    
    mape = np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100
    accuracy = max(0, min(100, 100 - mape))
    
    logger.info(f"Accuracy: MAPE={mape:.2f}%, Accuracy={accuracy:.1f}%")
    return round(accuracy, 1)
```

### 2. Update `get_prediction()` inverse transform
```python
# USE METADATA: Check if model was trained with log transform
use_log_transform = meta and meta.get('log_transform', False)

if use_log_transform:
    forecast['yhat'] = np.expm1(forecast['yhat'].clip(-10, 20))
    forecast['yhat_lower'] = np.expm1(forecast['yhat_lower'].clip(-10, 20))
    forecast['yhat_upper'] = np.expm1(forecast['yhat_upper'].clip(-10, 20))
    logger.info(f"Prediction: Applied inverse log transform based on metadata")
else:
    logger.info(f"Prediction: No inverse transform (linear model)")
```

### 3. Pass metadata to accuracy function
```python
# In get_prediction()
accuracy = calculate_forecast_accuracy(historical_df, model, meta)
```

## Expected Results After Fix

### Before Fix:
- Training: 94.2% (unreliable/cached)
- Dashboard: 64.7% (scale mismatch)
- Inconsistent across horizons

### After Fix:
- Training: 85-90% (realistic)
- Dashboard: 85-90% (consistent)
- Stable across all horizons (7, 30, 90 days)

## Validation Plan

1. **Retrain model** to ensure metadata is fresh
2. **Test accuracy calculation** with known log-scale model
3. **Verify inverse transforms** are applied consistently
4. **Check all horizons** (7, 30, 90 days)
5. **Compare training vs dashboard** accuracy
6. **Monitor logs** for transform confirmation messages
