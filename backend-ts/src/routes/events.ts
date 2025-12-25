import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { geminiService } from '../services/gemini';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all events - Return array directly for frontend compatibility
// Public access for viewing calendar
router.get('/', async (req: Request, res: Response) => {
    try {
        const events = await db.events.getAll();

        // Return array directly (not nested in object) to match Python backend
        res.json(events || []);
    } catch (error: any) {
        console.error('[Events] Get all failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Get AI suggestion for event classification (Admin only)
router.post('/suggest', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { title, description, date } = req.body;

        if (!title) {
            return res.status(400).json({
                status: 'error',
                error: 'Title is required'
            });
        }

        const classification = await geminiService.classifyEvent(title, description, date);

        res.json({
            status: 'success',
            suggestion: {
                suggested_category: classification.category,
                confidence: classification.confidence,
                rationale: classification.rationale,
            }
        });
    } catch (error: any) {
        console.error('[Events] AI suggestion failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Create event (Admin only)
router.post('/confirm', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { date, title, type, description, impact_weight } = req.body;

        // Validate event type
        const validTypes = ['promotion', 'holiday', 'store-closed', 'event'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                status: 'error',
                error: `Invalid event type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Only insert fields that exist in the database schema
        const event = await db.events.create({
            date,
            title,
            type,
            description: description || null,
            impact_weight: impact_weight || 1.0,
        });

        res.json({
            status: 'success',
            event
        });
    } catch (error: any) {
        console.error('[Events] Create failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Delete event (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        await db.events.delete(req.params.id);

        res.json({
            status: 'success',
            message: 'Event deleted'
        });
    } catch (error: any) {
        console.error('[Events] Delete failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
