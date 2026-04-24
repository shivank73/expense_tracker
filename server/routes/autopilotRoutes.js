import express from 'express';
// FIX: Added 'approveItem' to the import list below
import { getAutopilotData, addSubscription, addBill, addDebt, deleteItem, updateDebt, approveItem } from '../controllers/autopilotController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getAutopilotData);
router.post('/subscription', protect, addSubscription);
router.post('/bill', protect, addBill);
router.post('/debt', protect, addDebt);
router.delete('/:type/:id', protect, deleteItem);
router.patch('/debt/:id', protect, updateDebt);
router.post('/approve/:type/:id', protect, approveItem);

export default router;