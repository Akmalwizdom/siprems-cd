import { Router, Request, Response } from 'express';
import { supabase } from '../services/database';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all categories - Public access
router.get('/', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (error) throw error;

        res.json({
            status: 'success',
            categories: data || []
        });
    } catch (error: any) {
        console.error('[Categories] Get all failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Create category - Admin only
router.post('/', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                status: 'error',
                error: 'Category name is required'
            });
        }

        const { data, error } = await supabase
            .from('categories')
            .insert({
                name: name.trim(),
                description: description?.trim() || null
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    status: 'error',
                    error: 'Category already exists'
                });
            }
            throw error;
        }

        res.json({
            status: 'success',
            category: data
        });
    } catch (error: any) {
        console.error('[Categories] Create failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Update category - Admin only
router.patch('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updates: any = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    status: 'error',
                    error: 'Category name already exists'
                });
            }
            throw error;
        }

        res.json({
            status: 'success',
            category: data
        });
    } catch (error: any) {
        console.error('[Categories] Update failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Delete category - Admin only
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Check if category is in use by products
        const { data: products, error: checkError } = await supabase
            .from('products')
            .select('id')
            .eq('category', (await supabase.from('categories').select('name').eq('id', id).single()).data?.name)
            .limit(1);

        if (checkError) throw checkError;

        if (products && products.length > 0) {
            return res.status(400).json({
                status: 'error',
                error: 'Cannot delete category that is in use by products'
            });
        }

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            status: 'success',
            message: 'Category deleted successfully'
        });
    } catch (error: any) {
        console.error('[Categories] Delete failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
