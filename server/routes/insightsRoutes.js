import express from 'express';
import { getPhase1Insights } from '../controllers/insightsController.js';
// FIXED: Using the correct imported name
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// FIXED: Using the correct middleware variable
router.get('/phase1', protect, getPhase1Insights);

export default router;