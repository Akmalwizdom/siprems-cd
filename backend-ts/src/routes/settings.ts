import { Router, Response } from 'express';
import { supabase } from '../services/database';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/settings/store - Get store profile
router.get('/store', async (req, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('store_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            // If table doesn't exist or no row, return empty defaults
            if (error.code === 'PGRST116') {
                return res.json({
                    status: 'success',
                    data: {
                        name: '',
                        address: '',
                        phone: '',
                        logo_url: ''
                    }
                });
            }
            throw error;
        }

        res.json({
            status: 'success',
            data: {
                name: data.name || '',
                address: data.address || '',
                phone: data.phone || '',
                logo_url: data.logo_url || ''
            }
        });
    } catch (error: any) {
        console.error('[Settings] Error fetching store settings:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// PUT /api/settings/store - Update store profile (Admin only)
router.put('/store', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, address, phone, logo_url } = req.body;

        const { data, error } = await supabase
            .from('store_settings')
            .upsert({
                id: 1,
                name: name || '',
                address: address || '',
                phone: phone || '',
                logo_url: logo_url || ''
            }, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;

        res.json({
            status: 'success',
            message: 'Store settings updated successfully',
            data: {
                name: data.name || '',
                address: data.address || '',
                phone: data.phone || '',
                logo_url: data.logo_url || ''
            }
        });
    } catch (error: any) {
        console.error('[Settings] Error updating store settings:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
