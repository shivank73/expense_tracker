import express from 'express';
import { createBudget, getBudgets, deleteBudget } from '../controllers/budgetController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createBudget);
router.get('/', protect, getBudgets);
router.delete('/:id', protect, deleteBudget);

export default router;