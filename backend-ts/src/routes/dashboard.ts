import { Router, Request, Response } from 'express';
import { supabase } from '../services/database';

const router = Router();

// Get dashboard metrics (matches Python backend /api/dashboard/metrics)
router.get('/metrics', async (req: Request, res: Response) => {
    try {
        const range = req.query.range as string || 'month';
        const today = new Date();
        let currentStart: string;
        let currentEnd: string;
        let previousStart: string;
        let previousEnd: string;

        // Calculate date ranges based on selected period
        switch (range) {
            case 'today':
                // Today - use full timestamp range for proper comparison
                // Get start of today (00:00:00) and end of today (23:59:59) in local timezone adjusted
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
                currentStart = todayStart.toISOString();
                currentEnd = todayEnd.toISOString();
                // Yesterday
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
                const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
                previousStart = yesterdayStart.toISOString();
                previousEnd = yesterdayEnd.toISOString();
                break;
            case 'week':
                // This week (Monday to today)
                const dayOfWeek = today.getDay();
                const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const thisMonday = new Date(today);
                thisMonday.setDate(today.getDate() - mondayOffset);
                currentStart = thisMonday.toISOString().split('T')[0];
                currentEnd = today.toISOString().split('T')[0];
                // Last week
                const lastWeekMonday = new Date(thisMonday);
                lastWeekMonday.setDate(thisMonday.getDate() - 7);
                const lastWeekSunday = new Date(thisMonday);
                lastWeekSunday.setDate(thisMonday.getDate() - 1);
                previousStart = lastWeekMonday.toISOString().split('T')[0];
                previousEnd = lastWeekSunday.toISOString().split('T')[0];
                break;
            case 'year':
                // This year
                currentStart = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                currentEnd = today.toISOString().split('T')[0];
                // Last year
                previousStart = new Date(today.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
                previousEnd = new Date(today.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
                break;
            case 'month':
            default:
                // This month
                currentStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                // Last month
                previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                previousEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
                break;
        }

        console.log(`[Dashboard] Metrics range=${range}: currentStart=${currentStart}, currentEnd=${currentEnd}, previousStart=${previousStart}, previousEnd=${previousEnd}`);

        // Fetch current period data using pagination to bypass 1000 row limit
        let currentRevenue = 0;
        let currentTransactions = 0;
        let currentItems = 0;

        let allCurrentTx: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data: batch, error } = await supabase
                .from('transactions')
                .select('total_amount, items_count')
                .gte('date', currentStart)
                .lte('date', currentEnd)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;
            if (!batch || batch.length === 0) break;
            allCurrentTx = [...allCurrentTx, ...batch];
            if (batch.length < pageSize) break;
            page++;
        }
        currentRevenue = allCurrentTx.reduce((sum, t) => sum + (t.total_amount || 0), 0);
        currentTransactions = allCurrentTx.length;
        currentItems = allCurrentTx.reduce((sum, t) => sum + (t.items_count || 0), 0);
        console.log(`[Dashboard] Current period: ${currentTransactions} transactions, revenue: ${currentRevenue}`);

        // Get previous period metrics using same approach
        let previousRevenue = 0;
        let previousTransactions = 0;
        let previousItems = 0;

        let allPreviousTx: any[] = [];
        let prevPage = 0;
        // reuse pageSize from above
        while (true) {
            const { data: batch, error } = await supabase
                .from('transactions')
                .select('total_amount, items_count')
                .gte('date', previousStart)
                .lte('date', previousEnd)
                .range(prevPage * pageSize, (prevPage + 1) * pageSize - 1);

            if (error) throw error;
            if (!batch || batch.length === 0) break;
            allPreviousTx = [...allPreviousTx, ...batch];
            if (batch.length < pageSize) break;
            prevPage++;
        }
        previousRevenue = allPreviousTx.reduce((sum, t) => sum + (t.total_amount || 0), 0);
        previousTransactions = allPreviousTx.length;
        previousItems = allPreviousTx.reduce((sum, t) => sum + (t.items_count || 0), 0);

        console.log(`[Dashboard] Previous period: ${previousTransactions} transactions`);

        // Calculate percentage changes
        const revenueChange = previousRevenue > 0
            ? ((currentRevenue - previousRevenue) / previousRevenue * 100)
            : 0;
        const transactionsChange = previousTransactions > 0
            ? ((currentTransactions - previousTransactions) / previousTransactions * 100)
            : 0;
        const itemsChange = previousItems > 0
            ? ((currentItems - previousItems) / previousItems * 100)
            : 0;

        res.json({
            totalRevenue: currentRevenue,
            totalTransactions: currentTransactions,
            totalItemsSold: currentItems,
            revenueChange: Math.round(revenueChange * 10) / 10,
            transactionsChange: Math.round(transactionsChange * 10) / 10,
            itemsChange: Math.round(itemsChange * 10) / 10
        });
    } catch (error: any) {
        console.error('[Dashboard] Get metrics failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get sales trend (last 7 days)
router.get('/sales-trend', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('daily_sales_summary')
            .select('ds, y')
            .order('ds', { ascending: false })
            .limit(7);

        if (error) throw error;

        res.json({
            status: 'success',
            trend: data?.reverse() || []
        });
    } catch (error: any) {
        console.error('[Dashboard] Get sales trend failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get sales chart data (last 90 days) - Required by Dashboard.tsx
router.get('/sales-chart', async (req: Request, res: Response) => {
    try {
        // Calculate date 90 days ago
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const dateFilter = ninetyDaysAgo.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_sales_summary')
            .select('ds, y, transactions_count')
            .gte('ds', dateFilter)
            .order('ds', { ascending: true });

        if (error) throw error;

        // Format response to match frontend expectations
        const formattedData = (data || []).map(row => ({
            date: row.ds,
            sales: row.y || 0,
            transactions_count: row.transactions_count || 0
        }));

        res.json(formattedData);
    } catch (error: any) {
        console.error('[Dashboard] Get sales chart failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get category sales breakdown (last 90 days) - Required by Dashboard.tsx
router.get('/category-sales', async (req: Request, res: Response) => {
    try {
        // Category color mapping (Solid Indigo/Blue Theme)
        const CATEGORY_COLOR_MAP: Record<string, string> = {
            'Coffee': '#3457D5',      // Royal Azure
            'Tea': '#8A2BE2',         // Blue Violet
            'Non-Coffee': '#7B68EE',  // Medium Slate Blue
            'Pastry': '#4B61D1',      // Slate Indigo
            'Light Meals': '#6F00FF', // Neon Violet
            'Seasonal': '#4169E1'     // Royal Blue
        };

        // Calculate date 90 days ago
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const dateFilter = ninetyDaysAgo.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('category_sales_summary')
            .select('category, revenue')
            .gte('ds', dateFilter);

        if (error) throw error;

        // Aggregate by category
        const categoryTotals: Record<string, number> = {};
        (data || []).forEach(row => {
            const category = row.category || 'Unknown';
            categoryTotals[category] = (categoryTotals[category] || 0) + (row.revenue || 0);
        });

        // Format response with colors
        const formattedData = Object.entries(categoryTotals)
            .map(([category, revenue]) => ({
                category,
                value: revenue,
                color: CATEGORY_COLOR_MAP[category] || '#94a3b8' // Default gray for unknown categories
            }))
            .sort((a, b) => b.value - a.value); // Sort by revenue descending

        res.json(formattedData);
    } catch (error: any) {
        console.error('[Dashboard] Get category sales failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get today's summary - items sold, transactions, products sold
router.get('/today', async (req: Request, res: Response) => {
    try {
        const now = new Date();
        // Get start of today (00:00:00) and end of today (23:59:59)
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const todayStartISO = todayStart.toISOString();
        const todayEndISO = todayEnd.toISOString();

        console.log(`[Dashboard] Today range: ${todayStartISO} to ${todayEndISO}`);

        // Get today's transactions using proper timestamp range
        const { data: todayTx, error: txError } = await supabase
            .from('transactions')
            .select('id, total_amount, items_count, created_at, date')
            .gte('date', todayStartISO)
            .lte('date', todayEndISO);

        if (txError) throw txError;

        // Get today's transaction items with product info
        const { data: todayItems, error: itemsError } = await supabase
            .from('transaction_items')
            .select(`
                quantity,
                subtotal,
                product:products(id, name, category)
            `)
            .in('transaction_id', (todayTx || []).map(t => t.id));

        if (itemsError) throw itemsError;

        // Calculate metrics
        const totalTransactions = (todayTx || []).length;
        const totalRevenue = (todayTx || []).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const totalItems = (todayTx || []).reduce((sum, t) => sum + (t.items_count || 0), 0);

        // Aggregate products sold
        const productsSold: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
        (todayItems || []).forEach((item: any) => {
            const productId = item.product?.id;
            if (productId) {
                if (!productsSold[productId]) {
                    productsSold[productId] = {
                        name: item.product.name,
                        category: item.product.category || 'Unknown',
                        quantity: 0,
                        revenue: 0
                    };
                }
                productsSold[productId].quantity += item.quantity || 0;
                productsSold[productId].revenue += item.subtotal || 0;
            }
        });

        // Convert to array and sort by quantity
        const productsArray = Object.entries(productsSold)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.quantity - a.quantity);

        res.json({
            date: todayStartISO.split('T')[0],
            totalTransactions,
            totalRevenue,
            totalItems,
            uniqueProducts: productsArray.length,
            products: productsArray
        });
    } catch (error: any) {
        console.error('[Dashboard] Get today summary failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
