import { supabase } from './database';

/**
 * Interface for product demand prediction result
 */
export interface ProductDemandPrediction {
    productId: string;
    productName: string;
    category: string;
    currentStock: number;
    predictedDemand: number;        // Units predicted to be sold
    recommendedRestock: number;      // Amount to restock
    safetyStock: number;             // Safety stock buffer
    daysOfStock: number;             // Estimated days of stock remaining
    urgency: 'high' | 'medium' | 'low';
    confidence: number;              // 0-100%
    categoryGrowthFactor: number;    // Category-specific growth factor
    historicalSales: number;         // Historical units sold
    salesProportion: number;         // Proportion of total sales
}

/**
 * Interface for category sales summary
 */
interface CategorySales {
    category: string;
    totalUnits: number;
    totalRevenue: number;
    productCount: number;
    avgDailySales: number;
    growthFactor: number; // Week-over-week growth
}

/**
 * ProductForecastService
 * 
 * Calculates per-product demand predictions using:
 * 1. Time-weighted sales proportion (recent sales weighted higher)
 * 2. Category-level aggregation for more accurate proportions
 * 3. Safety stock calculation based on sales variability
 */
class ProductForecastService {
    /**
     * Calculate time-weighted sales for each product
     * Recent sales (last 30 days) are weighted 2x compared to older sales
     */
    async getTimeWeightedSales(lookbackDays: number = 90): Promise<{
        productSales: Record<number, { weighted: number; raw: number; recent: number; older: number }>;
        categorySales: Record<string, CategorySales>;
        totalWeightedUnits: number;
        totalRawUnits: number;
    }> {
        const now = new Date();
        const wibOffset = 7 * 60 * 60 * 1000;
        const nowWib = new Date(now.getTime() + wibOffset);
        const todayStr = nowWib.toISOString().split('T')[0];

        const recentCutoff = new Date(nowWib.getTime() - (30 * 24 * 60 * 60 * 1000));
        const recentCutoffStr = recentCutoff.toISOString().split('T')[0];

        const lookbackDate = new Date(nowWib.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));
        const lookbackStr = lookbackDate.toISOString().split('T')[0];

        console.log(`[ProductForecast] Fetching sales from ${lookbackStr} to ${todayStr}`);
        console.log(`[ProductForecast] Recent period: ${recentCutoffStr} to ${todayStr}`);

        // Fetch all transaction items with their transaction dates
        const { data: transactionItems, error: itemsError } = await supabase
            .from('transaction_items')
            .select(`
                product_id,
                quantity,
                unit_price,
                transactions!inner (
                    date
                )
            `)
            .gte('transactions.date', lookbackStr)
            .lte('transactions.date', todayStr);

        if (itemsError) {
            console.error('[ProductForecast] Error fetching transaction items:', itemsError);
            throw itemsError;
        }

        // Fetch products for category mapping
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, category, stock, selling_price');

        if (productsError) {
            console.error('[ProductForecast] Error fetching products:', productsError);
            throw productsError;
        }

        // Create product to category mapping
        const productCategory: Record<number, string> = {};
        const productPrice: Record<number, number> = {};
        products?.forEach(p => {
            productCategory[p.id] = p.category || 'Uncategorized';
            productPrice[p.id] = p.selling_price || 0;
        });

        // Calculate time-weighted sales per product
        const productSales: Record<number, { weighted: number; raw: number; recent: number; older: number }> = {};
        const categorySalesMap: Record<string, {
            recentUnits: number;
            olderUnits: number;
            recentRevenue: number;
            olderRevenue: number;
            products: Set<number>;
        }> = {};

        let totalWeightedUnits = 0;
        let totalRawUnits = 0;

        transactionItems?.forEach((item: any) => {
            const productId = item.product_id;
            const quantity = item.quantity || 0;
            const price = item.unit_price || 0;
            const txDate = item.transactions?.date;

            if (!productId || !txDate) return;

            const category = productCategory[productId] || 'Uncategorized';
            const isRecent = txDate >= recentCutoffStr;

            // Weight: recent sales (last 30 days) = 2x, older = 1x
            const weight = isRecent ? 2.0 : 1.0;
            const weightedQty = quantity * weight;

            // Product sales
            if (!productSales[productId]) {
                productSales[productId] = { weighted: 0, raw: 0, recent: 0, older: 0 };
            }
            productSales[productId].weighted += weightedQty;
            productSales[productId].raw += quantity;
            if (isRecent) {
                productSales[productId].recent += quantity;
            } else {
                productSales[productId].older += quantity;
            }

            totalWeightedUnits += weightedQty;
            totalRawUnits += quantity;

            // Category sales
            if (!categorySalesMap[category]) {
                categorySalesMap[category] = {
                    recentUnits: 0,
                    olderUnits: 0,
                    recentRevenue: 0,
                    olderRevenue: 0,
                    products: new Set(),
                };
            }
            categorySalesMap[category].products.add(productId);
            if (isRecent) {
                categorySalesMap[category].recentUnits += quantity;
                categorySalesMap[category].recentRevenue += quantity * price;
            } else {
                categorySalesMap[category].olderUnits += quantity;
                categorySalesMap[category].olderRevenue += quantity * price;
            }
        });

        // Calculate category-level metrics including growth factor
        const categorySales: Record<string, CategorySales> = {};
        for (const [category, data] of Object.entries(categorySalesMap)) {
            const totalUnits = data.recentUnits + data.olderUnits;
            const totalRevenue = data.recentRevenue + data.olderRevenue;

            // Calculate growth factor: recent vs older sales rate
            // Normalize by time period (30 days recent vs 60 days older)
            const recentDailyRate = data.recentUnits / 30;
            const olderDailyRate = data.olderUnits / Math.max(1, lookbackDays - 30);
            const growthFactor = olderDailyRate > 0
                ? recentDailyRate / olderDailyRate
                : 1.0;

            categorySales[category] = {
                category,
                totalUnits,
                totalRevenue,
                productCount: data.products.size,
                avgDailySales: totalUnits / lookbackDays,
                growthFactor: Math.min(3.0, Math.max(0.3, growthFactor)), // Cap between 0.3x - 3x
            };
        }

        console.log(`[ProductForecast] Processed ${Object.keys(productSales).length} products in ${Object.keys(categorySales).length} categories`);
        console.log(`[ProductForecast] Total units: raw=${totalRawUnits}, weighted=${totalWeightedUnits.toFixed(0)}`);

        return { productSales, categorySales, totalWeightedUnits, totalRawUnits };
    }

    /**
     * Calculate safety stock based on sales variability
     * Uses coefficient of variation to determine buffer
     */
    calculateSafetyStock(
        avgDailyDemand: number,
        stdDevDaily: number,
        leadTimeDays: number = 7,
        serviceLevel: number = 0.95
    ): number {
        // Z-score for 95% service level is approximately 1.65
        const zScore = serviceLevel === 0.95 ? 1.65 : serviceLevel === 0.99 ? 2.33 : 1.28;

        // Safety stock = Z * σ * √L (where L is lead time in days)
        const safetyStock = Math.ceil(zScore * stdDevDaily * Math.sqrt(leadTimeDays));

        // Minimum safety stock of 5 units or 3 days of demand
        return Math.max(safetyStock, Math.ceil(avgDailyDemand * 3), 5);
    }

    /**
     * Generate per-product demand predictions
     */
    async generateProductPredictions(
        totalPredictedRevenue: number,
        forecastDays: number = 30,
        categoryEvents?: Record<string, number> // Optional: category-specific event impact
    ): Promise<ProductDemandPrediction[]> {
        console.log(`[ProductForecast] Generating predictions for ${forecastDays} days`);
        console.log(`[ProductForecast] Total predicted revenue: ${totalPredictedRevenue.toFixed(0)}`);

        // Get time-weighted sales data
        const { productSales, categorySales, totalWeightedUnits, totalRawUnits } =
            await this.getTimeWeightedSales(90);

        // Fetch all products
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, category, stock, selling_price');

        if (productsError || !products) {
            console.error('[ProductForecast] Error fetching products:', productsError);
            return [];
        }

        // Calculate average product price for revenue to units conversion
        const avgProductPrice = products.reduce((sum, p) => sum + (p.selling_price || 0), 0) / products.length;
        const totalPredictedUnits = avgProductPrice > 0
            ? totalPredictedRevenue / avgProductPrice
            : totalPredictedRevenue;

        console.log(`[ProductForecast] Avg product price: ${avgProductPrice.toFixed(0)}`);
        console.log(`[ProductForecast] Total predicted units: ${totalPredictedUnits.toFixed(0)}`);

        const predictions: ProductDemandPrediction[] = [];

        for (const product of products) {
            const category = product.category || 'Uncategorized';
            const currentStock = product.stock || 0;
            const productId = product.id;

            // Get product's sales data
            const sales = productSales[productId] || { weighted: 0, raw: 0, recent: 0, older: 0 };
            const catData = categorySales[category];

            // Calculate time-weighted proportion
            let salesProportion: number;
            if (totalWeightedUnits > 0 && sales.weighted > 0) {
                // Use weighted sales for proportion
                salesProportion = sales.weighted / totalWeightedUnits;
            } else if (totalRawUnits > 0 && sales.raw > 0) {
                // Fallback to raw sales
                salesProportion = sales.raw / totalRawUnits;
            } else {
                // No sales history: distribute equally within category
                const categoryProducts = products.filter(p => (p.category || 'Uncategorized') === category);
                salesProportion = 1 / products.length;
            }

            // Get category growth factor
            const categoryGrowthFactor = catData?.growthFactor || 1.0;

            // Apply category-specific event impact if provided
            const eventMultiplier = categoryEvents?.[category] || 1.0;

            // Calculate predicted demand with growth factor and events
            const baseDemand = totalPredictedUnits * salesProportion;
            const adjustedDemand = baseDemand * categoryGrowthFactor * eventMultiplier;
            const predictedDemand = Math.ceil(adjustedDemand);

            // Calculate daily demand for safety stock
            const dailyDemand = predictedDemand / forecastDays;

            // Calculate variability from recent vs older sales
            const recentDaily = (sales.recent || 0) / 30;
            const olderDaily = (sales.older || 0) / 60;
            const stdDevDaily = Math.abs(recentDaily - olderDaily) / 2 + dailyDemand * 0.2;

            // Calculate safety stock
            const safetyStock = this.calculateSafetyStock(dailyDemand, stdDevDaily, 7, 0.95);

            // Days of stock remaining
            const daysOfStock = dailyDemand > 0
                ? Math.floor(currentStock / dailyDemand)
                : 999;

            // Recommended restock amount
            const targetStock = predictedDemand + safetyStock;
            const recommendedRestock = Math.max(0, targetStock - currentStock);

            // Determine urgency
            let urgency: 'high' | 'medium' | 'low' = 'low';
            const reorderPoint = safetyStock;

            if (daysOfStock < forecastDays / 3 || currentStock < reorderPoint / 2) {
                urgency = 'high';
            } else if (daysOfStock < forecastDays / 2 || currentStock < reorderPoint) {
                urgency = 'medium';
            }

            // Calculate confidence based on sales history
            let confidence = 70; // Base confidence
            if (sales.raw > 50) confidence += 20; // Good history
            else if (sales.raw > 20) confidence += 10;
            if (sales.recent > 10) confidence += 10; // Recent activity
            confidence = Math.min(95, confidence);

            // Only include products that need attention
            if (recommendedRestock > 0 || daysOfStock < forecastDays || urgency !== 'low') {
                predictions.push({
                    productId: productId.toString(),
                    productName: product.name,
                    category,
                    currentStock,
                    predictedDemand,
                    recommendedRestock,
                    safetyStock,
                    daysOfStock,
                    urgency,
                    confidence,
                    categoryGrowthFactor,
                    historicalSales: sales.raw,
                    salesProportion,
                });
            }
        }

        // Sort by urgency then by recommended restock amount
        predictions.sort((a, b) => {
            const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
            const aUrgency = urgencyOrder[a.urgency] ?? 2;
            const bUrgency = urgencyOrder[b.urgency] ?? 2;
            if (aUrgency !== bUrgency) return aUrgency - bUrgency;
            return b.recommendedRestock - a.recommendedRestock;
        });

        console.log(`[ProductForecast] Generated ${predictions.length} predictions`);
        console.log(`[ProductForecast] High urgency: ${predictions.filter(p => p.urgency === 'high').length}`);
        console.log(`[ProductForecast] Medium urgency: ${predictions.filter(p => p.urgency === 'medium').length}`);

        return predictions;
    }
}

// Export singleton instance
export const productForecastService = new ProductForecastService();
