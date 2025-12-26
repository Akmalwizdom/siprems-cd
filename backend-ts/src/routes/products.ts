import { Router, Request, Response } from 'express';
import { db, supabase } from '../services/database';
import { authenticate, requireAdmin, optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all products with pagination - Match frontend expectations
// Public access (no auth required for reading)
router.get('/', async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;
        const category = req.query.category as string;

        // Build query
        let query = supabase
            .from('products')
            .select('*', { count: 'exact' });

        // Apply filters
        if (search) {
            query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,sku.ilike.%${search}%`);
        }

        if (category && category !== 'All') {
            query = query.eq('category', category);
        }

        // Apply pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to).order('name');

        const { data, error, count } = await query;

        if (error) throw error;

        const total = count || 0;
        const total_pages = Math.ceil(total / limit);

        // Return paginated response format expected by frontend
        res.json({
            data: data || [],
            total,
            total_pages,
            page,
            limit
        });
    } catch (error: any) {
        console.error('[Products] Get all failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get product categories - Required by Transaction page
router.get('/categories', async (req: Request, res: Response) => {
    try {
        // Query from categories table instead of unique values from products
        const { data, error } = await supabase
            .from('categories')
            .select('name')
            .order('name');

        if (error) throw error;

        // Extract category names for backward compatibility
        const categories = (data || []).map(c => c.name);

        // Return in format expected by frontend
        res.json({ categories });
    } catch (error: any) {
        console.error('[Products] Get categories failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get product by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const product = await db.products.getById(req.params.id);

        if (!product) {
            return res.status(404).json({
                status: 'error',
                error: 'Product not found'
            });
        }

        res.json({
            status: 'success',
            product
        });
    } catch (error: any) {
        console.error('[Products] Get by ID failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Update product stock (Admin only)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { stock, price } = req.body;

        const updates: any = {};
        if (stock !== undefined) updates.stock = stock;
        // Map frontend 'price' to database 'selling_price' column
        if (price !== undefined) updates.selling_price = price;

        const product = await db.products.update(req.params.id, updates);

        res.json({
            status: 'success',
            product
        });
    } catch (error: any) {
        console.error('[Products] Update failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Create product (Admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, category, sku, stock, selling_price, cost_price, image_url, description } = req.body;

        if (!name || selling_price === undefined) {
            return res.status(400).json({
                status: 'error',
                error: 'Name and selling_price are required'
            });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                name,
                category: category || 'Uncategorized',
                sku: sku || null,
                stock: stock || 0,
                selling_price,
                cost_price: cost_price || 0,
                image_url: image_url || null,
                description: description || null,
            })
            .select()
            .single();

        if (error) throw error;

        res.json({
            status: 'success',
            product: data
        });
    } catch (error: any) {
        console.error('[Products] Create failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Delete product (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            status: 'success',
            message: 'Product deleted successfully'
        });
    } catch (error: any) {
        console.error('[Products] Delete failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Upload product image (Admin only)
router.post('/:id/image', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { image } = req.body; // Base64 encoded image

        if (!image) {
            return res.status(400).json({
                status: 'error',
                error: 'Image data is required'
            });
        }

        // Extract base64 data and content type
        const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({
                status: 'error',
                error: 'Invalid image format. Expected base64 data URL.'
            });
        }

        const contentType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate unique filename
        const extension = contentType.split('/')[1] || 'jpg';
        const filename = `product-${id}-${Date.now()}.${extension}`;
        const filePath = `products/${filename}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, buffer, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            console.error('[Products] Upload error:', uploadError);
            throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        const imageUrl = urlData.publicUrl;

        // Update product with new image URL
        const { data: product, error: updateError } = await supabase
            .from('products')
            .update({ image_url: imageUrl })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json({
            status: 'success',
            image_url: imageUrl,
            product
        });
    } catch (error: any) {
        console.error('[Products] Image upload failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
