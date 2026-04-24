import express from 'express';
import { 
  getPortfolioData, 
  addAsset, 
  updateAsset, 
  deleteAsset, 
  sellAsset,
  addPassiveIncome,
  getHoldings,     // <--- ADDED: Fetch Market Holdings
  buyHolding,      // <--- ADDED: Buy Order
  sellHolding,      // <--- ADDED: Sell Order
  updateHolding,
  deleteHolding
} from '../controllers/portfolioController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 🔒 Protect ALL portfolio and holding routes with authentication
router.use(protect);

// ==========================================
// 1. LOCAL ASSETS & SANDBOX
// ==========================================
router.get('/', getPortfolioData);
router.post('/asset', addAsset);
router.patch('/asset/:id', updateAsset);
router.delete('/asset/:id', deleteAsset);
router.post('/sell/:id', sellAsset); // Tangible Asset Realization

// ==========================================
// 2. PASSIVE INCOME TRACKER
// ==========================================
router.post('/passive', addPassiveIncome);

// ==========================================
// 3. MARKET HOLDINGS COMMAND
// ==========================================
router.get('/holdings', getHoldings);
router.post('/buy', buyHolding);
router.post('/holdings/sell/:id', sellHolding); // Market Asset Realization
// Add these to your Market Holdings routes at the bottom
router.patch('/holdings/:id', updateHolding);
router.delete('/holdings/:id', deleteHolding);

export default router;