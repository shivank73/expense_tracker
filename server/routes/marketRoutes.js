import express from 'express';
import { 
  getMarketIndices, 
  getMarketNews, 
  getMarketAIAnalysis 
} from '../controllers/marketController.js';

// If you have an auth middleware (like JWT), import it here so strangers can't drain your API limits
// import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// Define the endpoints. 
// Note: If you imported an auth middleware, insert it before the controller, e.g.: router.get('/indices', protect, getMarketIndices);
router.get('/indices', getMarketIndices);
router.get('/news', getMarketNews);
router.get('/ai', getMarketAIAnalysis);

export default router;