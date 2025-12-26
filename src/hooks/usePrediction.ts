import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { apiService, type PredictionResponse, type ModelAccuracyResponse } from '../services/api';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

// ============================================
// QUERY KEYS
// ============================================
export const predictionKeys = {
    all: ['prediction'] as const,
    result: (range: number) => [...predictionKeys.all, 'result', range] as const,
    accuracy: () => [...predictionKeys.all, 'accuracy'] as const,
};

// ============================================
// TYPES
// ============================================
interface CachedPredictionData {
    predictionData: PredictionResponse['chartData'];
    restockRecommendations: PredictionResponse['recommendations'];
    predictionMeta: PredictionResponse['meta'] | null;
    eventAnnotations: PredictionResponse['eventAnnotations'];
    dataFreshnessWarning: string | null;
    forecastAccuracy: number | null;
    accuracyDetails: ModelAccuracyResponse | null;
    generatedAt: string;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook to manage prediction data with caching
 * Results are cached and persist when navigating away
 */
export function usePrediction(predictionRange: 7 | 30 | 90) {
    const queryClient = useQueryClient();
    const { events } = useStore();
    const { getAuthToken } = useAuth();
    const [isRunning, setIsRunning] = useState(false);

    // Get cached prediction data
    const { data: cachedData, isLoading } = useQuery({
        queryKey: predictionKeys.result(predictionRange),
        queryFn: () => null as CachedPredictionData | null, // Initial is null
        staleTime: 30 * 60 * 1000, // Keep fresh for 30 minutes
        gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
        enabled: false, // Don't auto-fetch, we manually set data
    });

    // Run prediction and cache results
    const runPrediction = useCallback(async (): Promise<CachedPredictionData | null> => {
        setIsRunning(true);

        try {
            // Convert events to API format
            const impactDefaults: Record<string, number> = {
                promotion: 0.4,
                holiday: 0.9,
                event: 0.5,
                'store-closed': 1,
            };

            const apiEvents = events.map(event => ({
                date: event.date,
                type: event.type,
                title: event.title,
                impact: event.impact ?? impactDefaults[event.type] ?? 0.3,
            }));

            const token = await getAuthToken();

            // Call prediction API
            const response = await apiService.getPrediction(
                'store_1',
                apiEvents,
                undefined,
                predictionRange,
                token || undefined
            );

            if (response.status !== 'success') {
                throw new Error('Prediction failed');
            }

            // Determine data freshness warning
            let dataFreshnessWarning: string | null = null;
            if (response.meta?.warning) {
                dataFreshnessWarning = response.meta.warning;
            } else if (response.meta?.data_freshness?.status === 'stale' || response.meta?.data_freshness?.status === 'very_stale') {
                const days = response.meta.data_freshness.days_since_last_data;
                dataFreshnessWarning = `Data tidak segar - ${days} hari sejak transaksi terakhir. Prediksi telah disesuaikan.`;
            }

            // Fetch accuracy
            let forecastAccuracy: number | null = null;
            let accuracyDetails: ModelAccuracyResponse | null = null;

            try {
                const accuracyResult = await apiService.getModelAccuracy('store_1', token || undefined);
                forecastAccuracy = accuracyResult.accuracy;
                accuracyDetails = accuracyResult;

                // Check for data freshness warning from accuracy
                if (!dataFreshnessWarning && accuracyResult.warning) {
                    dataFreshnessWarning = accuracyResult.warning;
                } else if (!dataFreshnessWarning && (accuracyResult.data_freshness?.status === 'stale' || accuracyResult.data_freshness?.status === 'very_stale')) {
                    const days = accuracyResult.data_freshness?.days_since_last_transaction;
                    dataFreshnessWarning = `Data tidak segar - ${days} hari sejak transaksi terakhir`;
                }
            } catch (error) {
                console.error('Error fetching accuracy:', error);
            }

            // Create cached data object
            const newCachedData: CachedPredictionData = {
                predictionData: response.chartData,
                restockRecommendations: response.recommendations,
                predictionMeta: response.meta,
                eventAnnotations: response.eventAnnotations || [],
                dataFreshnessWarning,
                forecastAccuracy,
                accuracyDetails,
                generatedAt: new Date().toISOString(),
            };

            // Store in React Query cache
            queryClient.setQueryData(predictionKeys.result(predictionRange), newCachedData);

            return newCachedData;
        } catch (error) {
            console.error('Prediction error:', error);
            throw error;
        } finally {
            setIsRunning(false);
        }
    }, [events, getAuthToken, predictionRange, queryClient]);

    // Update recommendations in cache (after restock)
    const updateRecommendations = useCallback((productId: string) => {
        const currentData = queryClient.getQueryData<CachedPredictionData>(predictionKeys.result(predictionRange));
        if (currentData) {
            const updatedData: CachedPredictionData = {
                ...currentData,
                restockRecommendations: currentData.restockRecommendations.filter(
                    item => item.productId !== productId
                ),
            };
            queryClient.setQueryData(predictionKeys.result(predictionRange), updatedData);
        }
    }, [queryClient, predictionRange]);

    // Update stock values in cache after restock (for realtime UI update)
    const updateStockAfterRestock = useCallback((productId: string, restockQuantity: number) => {
        const currentData = queryClient.getQueryData<CachedPredictionData>(predictionKeys.result(predictionRange));
        if (currentData) {
            const updatedData: CachedPredictionData = {
                ...currentData,
                restockRecommendations: currentData.restockRecommendations.map(item => {
                    if (item.productId === productId) {
                        const newCurrentStock = item.currentStock + restockQuantity;
                        const newRecommendedRestock = Math.max(0, item.recommendedRestock - restockQuantity);
                        return {
                            ...item,
                            currentStock: newCurrentStock,
                            recommendedRestock: newRecommendedRestock,
                        };
                    }
                    return item;
                }),
            };
            queryClient.setQueryData(predictionKeys.result(predictionRange), updatedData);
        }
    }, [queryClient, predictionRange]);

    // Clear cache
    const clearCache = useCallback(() => {
        queryClient.removeQueries({ queryKey: predictionKeys.result(predictionRange) });
    }, [queryClient, predictionRange]);

    return {
        // Data
        cachedData,
        hasCachedData: !!cachedData,

        // Loading states
        isLoading,
        isRunning,

        // Actions
        runPrediction,
        updateRecommendations,
        updateStockAfterRestock,
        clearCache,
    };
}
