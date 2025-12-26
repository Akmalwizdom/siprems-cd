import express from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'siprems-backend-ts' });
});

// API routes
import transactionsRouter from './routes/transactions';
import productsRouter from './routes/products';
import eventsRouter from './routes/events';
import dashboardRouter from './routes/dashboard';
import holidaysRouter from './routes/holidays';
import forecastRouter from './routes/forecast';
import chatRouter from './routes/chat';
import usersRouter from './routes/users';
import settingsRouter from './routes/settings';
import categoriesRouter from './routes/categories';

app.use('/api/transactions', transactionsRouter);
app.use('/api/products', productsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/calendar/events', eventsRouter); // Alias for Python backend compatibility
app.use('/api/dashboard', dashboardRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/forecast', forecastRouter);
app.use('/api/predict', forecastRouter); // Alias for frontend compatibility
app.use('/api/model', forecastRouter); // Alias for model endpoints
app.use('/api/chat', chatRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/categories', categoriesRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
    });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    console.log(`✅ Backend TS running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
