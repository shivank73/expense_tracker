import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
// NEW TRANSACTION ROUTE IMPORT
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import autopilotRoutes from './routes/autopilotRoutes.js';
import cron from 'node-cron';
import { runAutoPayCron } from './controllers/autopilotController.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import goalRoutes from './routes/goalRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';
import settingsRoutes from './routes/settings.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

// NEW TRANSACTION ROUTE MOUNT
app.use('/api/transactions', transactionRoutes);
// NEW BUDGET ROUTE MOUNT 
app.use('/api/budgets', budgetRoutes);
//autopilot route 
app.use('/api/autopilot', autopilotRoutes);
//portfolio route 
app.use('/api/portfolio', portfolioRoutes);
//market route 
app.use('/api/market', marketRoutes);
//goals route 
app.use('/api/goals', goalRoutes);
//insights route 
app.use('/api/insights', insightsRoutes);
//settings route 
app.use('/api/settings', settingsRoutes);


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running smoothly with ES Modules.' });
});

// At the bottom, schedule the cron job (Runs exactly at 00:00 / Midnight every day)
cron.schedule('0 0 * * *', () => {
    console.log('[System] Running midnight Auto-Pay evaluation...');
    runAutoPayCron();
});

// THE FIX: Run a "catch-up" sweep the instant the server boots up
setTimeout(() => {
    console.log('[System] Initializing catch-up Auto-Pay evaluation...');
    runAutoPayCron().catch(err => console.error("Auto-Pay Error:", err.message));
}, 3000);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});