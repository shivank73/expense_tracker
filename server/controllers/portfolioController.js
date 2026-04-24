import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. Get all Sandbox Data
export const getPortfolioData = async (req, res) => {
  try {
    const userId = req.user.id; // FIXED
    const assets = await prisma.asset.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const passiveIncomes = await prisma.passiveIncome.findMany({ where: { userId }, orderBy: { date: 'asc' } });
    res.status(200).json({ assets, passiveIncomes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
};

// 2. Add New Asset
export const addAsset = async (req, res) => {
  try {
    const { name, type, currentValue, targetValue, category } = req.body;
    const asset = await prisma.asset.create({
      data: {
        name, type, currentValue, targetValue, category,
        initialValue: type === 'TANGIBLE' ? currentValue : null, // Lock in cost basis for ROI
        userId: req.user.id // FIXED
      }
    });
    res.status(201).json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add asset' });
  }
};

// 3. Local Update (No Dashboard Impact)
export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentValue } = req.body;
    const asset = await prisma.asset.update({
      where: { id, userId: req.user.id }, // FIXED
      data: { currentValue }
    });
    res.status(200).json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update asset' });
  }
};

// 4. Hard Delete (No Dashboard Impact)
export const deleteAsset = async (req, res) => {
  try {
    await prisma.asset.delete({ where: { id: req.params.id, userId: req.user.id } }); // FIXED
    res.status(200).json({ message: 'Asset removed locally' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
};

// 5. THE DELTA BRIDGE: Realize Gains/Losses to Reality Ledger
export const sellAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { finalValue } = req.body;
    const userId = req.user.id; // FIXED

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.userId !== userId) return res.status(404).json({ error: 'Asset not found' });

    const profitDelta = parseFloat(finalValue) - (asset.initialValue || 0);

    // Cross the bridge if money was created or destroyed
    if (profitDelta > 0) {
      await prisma.transaction.create({
        data: { name: `Sold ${asset.name} (ROI)`, amount: profitDelta, type: 'income', category: 'Investments', date: new Date(), userId }
      });
    } else if (profitDelta < 0) {
      await prisma.transaction.create({
        data: { name: `Sold ${asset.name} (Loss)`, amount: Math.abs(profitDelta), type: 'expense', category: 'Other Expense', date: new Date(), userId }
      });
    }

    // Destroy the local Sandbox asset
    await prisma.asset.delete({ where: { id } });
    res.status(200).json({ message: 'Delta processed successfully', profitDelta });
  } catch (error) {
    res.status(500).json({ error: 'Bridge transfer failed' });
  }
};

// Add Freelance/Passive Income Instance
export const addPassiveIncome = async (req, res) => {
  try {
    const { amount, date, source } = req.body;
    const income = await prisma.passiveIncome.create({
      data: {
        source: source || 'Freelance',
        amount: parseFloat(amount),
        date: new Date(date),
        category: 'Freelance',
        userId: req.user.id
      }
    });
    res.status(201).json(income);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log passive income' });
  }
};

// 1. THE BUY ENGINE (Interconnected Deduction)
export const buyHolding = async (req, res) => {
  try {
    // 1. Extract the new fields from the incoming request
    const { type, symbol, quantity, averageCost, fundingSourceId, maturityDate, category, sipAmount, interestRate } = req.body;
    
    // For MFs, initial deduction might be just the first SIP amount. For FDs/Stocks, it's qty * cost.
    const totalCost = type === 'MF' && sipAmount ? parseFloat(sipAmount) : parseFloat(quantity) * parseFloat(averageCost);

    // 2. Interconnected Deduction Engine
    if (fundingSourceId) {
      const sourceAsset = await prisma.asset.findUnique({ where: { id: fundingSourceId } });
      if (!sourceAsset || sourceAsset.currentValue < totalCost) {
        return res.status(400).json({ error: "Insufficient liquid funds." });
      }
      await prisma.asset.update({
        where: { id: fundingSourceId },
        data: { currentValue: sourceAsset.currentValue - totalCost }
      });
    }

    // 3. Lock in the Advanced Holding
    const holding = await prisma.holding.create({
      data: {
        userId: req.user.id, type, symbol, category: category || 'General',
        quantity: parseFloat(quantity), averageCost: parseFloat(averageCost),
        currentPrice: parseFloat(averageCost), fundingSourceId,
        maturityDate: maturityDate ? new Date(maturityDate) : null,
        sipAmount: sipAmount ? parseFloat(sipAmount) : null,
        interestRate: interestRate ? parseFloat(interestRate) : null,
      }
    });

    res.status(201).json({ holding, message: `Order executed for ${symbol}.` });
  } catch (error) {
    console.error("BUY HOLDING ERROR:", error);
    res.status(500).json({ error: 'Failed to execute order.' });
  }
};

// 2. THE SELL ENGINE (Principal Returns to Bank, Delta goes to Dashboard)
export const sellHolding = async (req, res) => {
  try {
    const { id } = req.params;
    const { sellPrice } = req.body; // The price you sold it at

    const holding = await prisma.holding.findUnique({ where: { id } });
    if (!holding) return res.status(404).json({ error: "Holding not found" });

    const initialBasis = holding.quantity * holding.averageCost;
    const finalValue = holding.quantity * parseFloat(sellPrice);
    const delta = finalValue - initialBasis; // Profit or Loss

    // 1. Return Principal + Profit back to original Bank Account
    if (holding.fundingSourceId) {
      const sourceAsset = await prisma.asset.findUnique({ where: { id: holding.fundingSourceId } });
      if (sourceAsset) {
        await prisma.asset.update({
          where: { id: holding.fundingSourceId },
          data: { currentValue: sourceAsset.currentValue + finalValue }
        });
      }
    }

    // 2. Push ONLY the Delta to the Main Dashboard Ledger
    if (Math.abs(delta) > 0.01) {
      await prisma.transaction.create({
        data: {
          userId: req.user.id,
          name: `Realized ${holding.symbol} Position`,
          amount: Math.abs(delta),
          type: delta > 0 ? 'income' : 'expense',
          category: delta > 0 ? 'Investments' : 'Other Expense',
          date: new Date()
        }
      });
    }

    // 3. Liquidate the Holding
    await prisma.holding.delete({ where: { id } });

    res.status(200).json({ message: "Position liquidated.", profitDelta: delta, finalValue });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute sell order.' });
  }
};

// Fetch Market Holdings
export const getHoldings = async (req, res) => {
  try {
    const holdings = await prisma.holding.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(holdings);
  } catch (error) {
    console.error("GET HOLDINGS ERROR:", error);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
};

// Update a Holding's Current Price
export const updateHolding = async (req, res) => {
  try {
    const { currentPrice } = req.body;
    const holding = await prisma.holding.update({
      where: { id: req.params.id },
      data: { currentPrice: parseFloat(currentPrice) }
    });
    res.status(200).json(holding);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update holding.' });
  }
};

// Drop/Delete a Holding
export const deleteHolding = async (req, res) => {
  try {
    await prisma.holding.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Asset Dropped' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to drop holding.' });
  }
};