import { Router, Request, Response } from 'express';
import { mlClient } from '../services/ml-client';
import { supabase } from '../services/database';
import { authenticate, requireAdmin, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { holidayService } from '../services/holiday';
import { productForecastService } from '../services/product-forecast';

const router = Router();

// Train Prophet model (Admin only)
router.post('/train', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { store_id, end_date, force_retrain } = req.body;

        if (!store_id) {
            return res.status(400).json({
                status: 'error',
                error: 'store_id is required'
            });
        }

        const result = await mlClient.trainModel(store_id, end_date, force_retrain);

        res.json(result);
    } catch (error: any) {
        console.error('[Forecast] Train failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get forecast predictions (Admin only)
router.post('/predict', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { store_id, periods, events } = req.body;

        if (!store_id) {
            return res.status(400).json({
                status: 'error',
                error: 'store_id is required'
            });
        }

        const result = await mlClient.predict({
            store_id,
            periods: periods || 30,
            events: events || [],
        });

        res.json(result);
    } catch (error: any) {
        console.error('[Forecast] Predict failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get model status (Admin only)
router.get('/model/:store_id/status', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { store_id } = req.params;
        const status = await mlClient.getModelStatus(store_id);

        res.json({
            status: 'success',
            model: status
        });
    } catch (error: any) {
        console.error('[Forecast] Get status failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get model accuracy (Admin only)
router.get('/model/accuracy', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const store_id = req.query.store_id as string || '1';
        const status = await mlClient.getModelStatus(store_id);

        // Extract accuracy info from model status
        if (status.exists) {
            res.json({
                status: 'success',
                accuracy: status.accuracy || null,
                train_mape: status.train_mape || null,
                validation_mape: status.validation_mape || null,
                error_gap: status.validation_mape && status.train_mape
                    ? Math.abs(status.validation_mape - status.train_mape)
                    : null,
                fit_status: status.accuracy && status.accuracy > 90 ? 'good' : 'fair',
                data_points: status.data_points || null,
                model_version: status.store_id || null,
                last_trained: status.last_trained || null,
            });
        } else {
            res.json({
                status: 'no_model',
                accuracy: null,
                train_mape: null,
                validation_mape: null,
                error_gap: null,
                fit_status: 'unknown',
            });
        }
    } catch (error: any) {
        console.error('[Forecast] Get model accuracy failed:', error);
        res.status(500).json({
            status: 'error',
            accuracy: null,
            train_mape: null,
            validation_mape: null,
            error_gap: null,
            fit_status: 'unknown',
        });
    }
});

// Predict endpoint with store_id in path - for frontend compatibility (Admin only)
router.post('/:store_id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { store_id } = req.params;
        const { periods, events } = req.body;

        const result = await mlClient.predict({
            store_id,
            periods: periods || 30,
            events: events || [],
        });

        // Transform ML service response to frontend format
        // ML service returns: {status, predictions: [{ds, yhat, yhat_lower, yhat_upper}], metadata}
        // Frontend expects: {status, chartData: [{date, predicted, lower, upper, historical}], recommendations, meta, eventAnnotations}

        const predictions = result.predictions || [];

        // Use WIB timezone (UTC+7) for consistent date handling
        const now = new Date();
        const wibOffset = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
        const nowWib = new Date(now.getTime() + wibOffset);
        const todayWib = nowWib.toISOString().split('T')[0];

        // Fetch historical data for the last 30 days from daily_sales_summary
        // This table is pre-aggregated and matches what dashboard uses
        const thirtyDaysAgo = new Date(nowWib.getTime() - (30 * 24 * 60 * 60 * 1000));
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

        console.log(`[Forecast] Fetching history from ${thirtyDaysAgoStr} to ${todayWib} (WIB)`);

        const { data: historicalData, error: historyError } = await supabase
            .from('daily_sales_summary')
            .select('ds, y')
            .gte('ds', thirtyDaysAgoStr)
            .lte('ds', todayWib)
            .order('ds', { ascending: true });

        if (historyError) {
            console.error('[Forecast] Error fetching history:', historyError);
        }

        // Create map of historical sales by date
        const dailyHistory: Record<string, number> = {};
        if (historicalData) {
            historicalData.forEach(row => {
                dailyHistory[row.ds] = row.y || 0;
            });
            console.log(`[Forecast] Loaded ${historicalData.length} days of historical data`);
        }

        // Generate full 30-day range to ensure continuity
        const historicalChartData = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(nowWib.getTime() - (i * 24 * 60 * 60 * 1000));
            const dateStr = d.toISOString().split('T')[0];

            historicalChartData.push({
                date: dateStr,
                predicted: null,
                lower: null,
                upper: null,
                historical: dailyHistory[dateStr] || 0, // Use 0 for days with no sales
                isHoliday: false
            });
        }

        // Create prediction chart data points
        const predictionChartData = predictions.map((pred: any) => ({
            date: pred.ds,
            predicted: Math.round(pred.yhat),
            lower: Math.round(pred.yhat_lower),
            upper: Math.round(pred.yhat_upper),
            historical: null,
            isHoliday: false,
        }));

        // Merge historical and prediction data
        const chartData = [...historicalChartData, ...predictionChartData];

        // Calculate growth factor from prediction trend
        let appliedFactor = 1.0; // Default to 1.0 (0% growth) to avoid NaN
        if (predictions.length >= 14) {
            const first7Avg = predictions.slice(0, 7).reduce((sum: number, p: any) => sum + (p.yhat || 0), 0) / 7;
            const last7Avg = predictions.slice(-7).reduce((sum: number, p: any) => sum + (p.yhat || 0), 0) / 7;
            if (first7Avg > 0 && !isNaN(first7Avg) && !isNaN(last7Avg)) {
                appliedFactor = last7Avg / first7Avg;
            }
        } else if (predictions.length >= 2) {
            const firstValue = predictions[0]?.yhat || 0;
            const lastValue = predictions[predictions.length - 1]?.yhat || 0;
            if (firstValue > 0 && !isNaN(firstValue) && !isNaN(lastValue)) {
                appliedFactor = lastValue / firstValue;
            }
        }

        // Final validation to ensure appliedFactor is always valid
        if (!isFinite(appliedFactor) || isNaN(appliedFactor)) {
            appliedFactor = 1.0;
        }

        // Generate stock recommendations using enhanced ProductForecastService
        // This uses time-weighted sales proportion and category-level growth factors
        let recommendations: any[] = [];

        try {
            // Calculate total predicted revenue from ML predictions
            const totalPredictedRevenue = predictions.reduce((sum: number, p: any) =>
                sum + (p.yhat || 0), 0);

            const forecastDays = periods || 30;

            console.log(`[Forecast] Using ProductForecastService for recommendations`);
            console.log(`[Forecast] Total predicted revenue: ${totalPredictedRevenue.toFixed(0)}, days: ${forecastDays}`);

            // Get enhanced predictions from ProductForecastService
            const productPredictions = await productForecastService.generateProductPredictions(
                totalPredictedRevenue,
                forecastDays
            );

            // Transform to frontend format (compatible with existing RestockRecommendation interface)
            recommendations = productPredictions.map(pred => ({
                productId: pred.productId,
                productName: pred.productName,
                category: pred.category,
                currentStock: pred.currentStock,
                predictedDemand: pred.predictedDemand,
                recommendedRestock: pred.recommendedRestock,
                urgency: pred.urgency,
                // Enhanced fields from new service
                safetyStock: pred.safetyStock,
                daysOfStock: pred.daysOfStock,
                confidence: pred.confidence,
                categoryGrowthFactor: pred.categoryGrowthFactor,
                historicalSales: pred.historicalSales,
                salesProportion: pred.salesProportion,
            }));

            console.log(`[Forecast] Generated ${recommendations.length} product recommendations`);
            console.log(`[Forecast] High urgency: ${recommendations.filter(r => r.urgency === 'high').length}`);
            console.log(`[Forecast] Medium urgency: ${recommendations.filter(r => r.urgency === 'medium').length}`);

        } catch (error) {
            console.error('[Forecast] Error generating recommendations:', error);
            // Continue without recommendations if there's an error
        }


        // Determine chart date range for filtering events
        const chartStartDate = historicalChartData[0]?.date;
        const chartEndDate = predictions.length > 0
            ? predictions[predictions.length - 1]?.ds
            : historicalChartData[historicalChartData.length - 1]?.date;

        console.log(`[Forecast] Chart date range: ${chartStartDate} to ${chartEndDate}`);
        console.log(`[Forecast] Received ${(events || []).length} events from frontend:`, JSON.stringify(events || [], null, 2));

        // Calculate event annotations from events - ONLY for events within chart date range
        const eventAnnotations: { date: string; titles: string[]; types: string[] }[] = (events || [])
            .filter((event: any) => {
                // Filter events to only those within chart date range
                const isInRange = event.date >= chartStartDate && event.date <= chartEndDate;
                if (!isInRange) {
                    console.log(`[Forecast] Event "${event.title}" on ${event.date} is OUTSIDE chart range`);
                }
                return isInRange;
            })
            .reduce((acc: any[], event: any) => {
                const existing = acc.find(a => a.date === event.date);
                if (existing) {
                    existing.titles.push(event.title || event.type);
                    existing.types.push(event.type);
                } else {
                    acc.push({
                        date: event.date,
                        titles: [event.title || event.type],
                        types: [event.type],
                    });
                }
                return acc;
            }, []);

        console.log(`[Forecast] After filtering: ${eventAnnotations.length} event annotations within chart range`);

        // Fetch national holidays for the chart date range and merge into eventAnnotations
        try {
            // chartStartDate and chartEndDate are already defined above
            if (chartStartDate && chartEndDate) {
                const startYear = new Date(chartStartDate).getFullYear();
                const endYear = new Date(chartEndDate).getFullYear();

                console.log(`[Forecast] Fetching holidays for years ${startYear}-${endYear} (chart: ${chartStartDate} to ${chartEndDate})`);

                // Fetch holidays for all years in the chart range
                for (let year = startYear; year <= endYear; year++) {
                    const holidays = await holidayService.getHolidaysForYear(year);

                    for (const holiday of holidays) {
                        // Only include holidays within the chart date range
                        if (holiday.date >= chartStartDate && holiday.date <= chartEndDate) {
                            const existing = eventAnnotations.find(a => a.date === holiday.date);
                            if (existing) {
                                // Add holiday to existing annotation if not already present
                                if (!existing.titles.includes(holiday.name)) {
                                    existing.titles.push(holiday.name);
                                    existing.types.push(holiday.is_national_holiday ? 'holiday' : 'event');
                                }
                            } else {
                                // Create new annotation for holiday
                                eventAnnotations.push({
                                    date: holiday.date,
                                    titles: [holiday.name],
                                    types: [holiday.is_national_holiday ? 'holiday' : 'event'],
                                });
                            }
                        }
                    }
                }

                // Sort annotations by date
                eventAnnotations.sort((a, b) => a.date.localeCompare(b.date));
                console.log(`[Forecast] Total event annotations (including holidays): ${eventAnnotations.length}`);
            }
        } catch (error) {
            console.error('[Forecast] Error fetching holidays for annotations:', error);
            // Continue without holidays if there's an error
        }

        const transformedResponse = {
            status: result.status || 'success',
            chartData,
            recommendations,
            eventAnnotations,
            meta: {
                applied_factor: appliedFactor,
                historicalDays: result.metadata?.historical_days || 0,
                forecastDays: periods || 30,
                lastHistoricalDate: result.metadata?.last_historical_date,
                accuracy: result.metadata?.model_accuracy,
                train_mape: result.metadata?.train_mape,
                validation_mape: result.metadata?.validation_mape,
            },
        };

        console.log(`[Forecast] Transformed response: ${chartData.length} data points, growth factor: ${appliedFactor.toFixed(2)}`);
        res.json(transformedResponse);
    } catch (error: any) {
        console.error('[Forecast] Predict with path param failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
