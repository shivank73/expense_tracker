import express from 'express';
import { getGoals, createGoal, injectFunds, toggleLock, deleteGoal } from '../controllers/goalController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getGoals);
router.post('/', createGoal);
router.post('/:id/inject', injectFunds); // New: For fractional tagging
router.patch('/:id/lock', toggleLock);   // New: For accountability guardrails
router.delete('/:id', deleteGoal);

export default router;