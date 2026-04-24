import express from 'express';
import {protect}from '../middleware/authMiddleware.js'; 
import { 
  getUserSettings, updatePreferences, changePassword, 
  createCustomTag, deleteCustomTag, exportLedgerCSV, 
  purgeLedger, deleteAccount 
} from '../controllers/settingsController.js';

const router = express.Router();

router.use(protect); 

router.get('/', getUserSettings);
router.patch('/preferences', updatePreferences);
router.post('/password', changePassword);

router.post('/tags', createCustomTag);
router.delete('/tags/:id', deleteCustomTag);

router.get('/export', exportLedgerCSV);

router.delete('/purge', purgeLedger);
router.delete('/account', deleteAccount);

export default router;