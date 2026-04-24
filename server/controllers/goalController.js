import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper: Securely extracts the user ID and ensures it matches your 'Int' schema requirement.
const getUserId = (req) => {
  const id = req.user?.id || req.user?.userId || req.userId;
  return isNaN(Number(id)) ? id : Number(id); 
};

// 1. GET GOALS (Dynamic Calculation Engine)
export const getGoals = async (req, res) => {
  try {
    const userId = getUserId(req);

    // Fetch goals and their fractional allocation tags
    const goals = await prisma.goal.findMany({
      where: { userId },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch master portfolio data to run the math against
    const allAssets = await prisma.asset.findMany({ where: { userId } });
    const allHoldings = await prisma.holding.findMany({ where: { userId } }); 

    const dynamicGoals = goals.map(goal => {
      let dynamicCurrentAmount = 0;
      
      const mappedAllocations = goal.allocations.map(alloc => {
        let liveAssetValue = 0;
        let assetName = 'Unknown Asset';

        if (alloc.sourceType === 'ASSET') {
          const asset = allAssets.find(a => a.id === alloc.sourceId);
          // MAPPED TO SCHEMA: Uses 'currentValue'
          if (asset) { liveAssetValue = asset.currentValue; assetName = asset.name; }
        } else if (alloc.sourceType === 'HOLDING') {
          const holding = allHoldings.find(h => h.id === alloc.sourceId);
          // MAPPED TO SCHEMA: Uses 'quantity * currentPrice'
          if (holding) { liveAssetValue = holding.quantity * holding.currentPrice; assetName = holding.symbol; }
        }

        // The Engine: Fractional Share * Live Market Value
        const currentDollarValue = liveAssetValue * alloc.fractionalShare;
        dynamicCurrentAmount += currentDollarValue;

        return {
          ...alloc,
          assetName,
          amount: parseFloat(currentDollarValue.toFixed(2)) 
        };
      });

      return {
        ...goal,
        currentAmount: parseFloat(dynamicCurrentAmount.toFixed(2)),
        remainingDelta: parseFloat((goal.targetAmount - dynamicCurrentAmount).toFixed(2)),
        isOnTrack: dynamicCurrentAmount >= goal.targetAmount,
        allocations: mappedAllocations
      };
    });

    res.json(dynamicGoals);
  } catch (error) {
    console.error('Fetch Goals Error:', error);
    res.status(500).json({ error: 'Failed to sync dynamic ledger.' });
  }
};

// 2. CREATE GOAL
export const createGoal = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, targetAmount, deadline, category, color, monthlyContribution, initialAllocation } = req.body;

    // Matches your schema exactly (no static currentAmount or remainingDelta)
    const newGoal = await prisma.goal.create({
      data: {
        userId, 
        name,
        targetAmount: Number(targetAmount),
        deadline: deadline ? new Date(deadline) : null,
        category: category || 'General',
        color: color || '#0A84FF',
        monthlyContribution: Number(monthlyContribution) || 0
      }
    });

    // Process Initial Fractional Injection (If provided)
    if (initialAllocation && Number(initialAllocation.amount) > 0) {
      const { type, id, amount } = initialAllocation;
      const amountNum = Number(amount);
      
      let liveAssetValue = 0;
      if (type === 'ASSET') {
        const asset = await prisma.asset.findUnique({ where: { id } });
        if (asset) liveAssetValue = asset.currentValue; // SCHEMA MATCH
      } else {
        const holding = await prisma.holding.findUnique({ where: { id } });
        if (holding) liveAssetValue = holding.quantity * holding.currentPrice; // SCHEMA MATCH
      }

      if (liveAssetValue > 0) {
        const fractionalShare = amountNum / liveAssetValue;
        
        await prisma.goalAllocation.create({
          data: {
            goal: { connect: { id: newGoal.id } }, // Ultra-safe Prisma relational connect
            sourceId: id,
            sourceType: type,
            fractionalShare: fractionalShare,
            lockedAtValue: amountNum
          }
        });
      }
    }

    res.json(newGoal);
  } catch (error) {
    console.error('Create Goal Error:', error);
    res.status(500).json({ error: 'Failed to create goal.' });
  }
};

// 3. INJECT/RECLAIM FUNDS (Fractional Conversion Engine)
export const injectFunds = async (req, res) => {
  try {
    const { id } = req.params; 
    const { sourceType, sourceId, amount } = req.body;
    const amountNum = Number(amount);

    let liveAssetValue = 0;
    if (sourceType === 'ASSET') {
      const asset = await prisma.asset.findUnique({ where: { id: sourceId } });
      if (!asset) return res.status(404).json({ error: 'Asset not found.' });
      liveAssetValue = asset.currentValue; // SCHEMA MATCH
    } else {
      const holding = await prisma.holding.findUnique({ where: { id: sourceId } });
      if (!holding) return res.status(404).json({ error: 'Holding not found.' });
      liveAssetValue = holding.quantity * holding.currentPrice; // SCHEMA MATCH
    }

    if (liveAssetValue <= 0) return res.status(400).json({ error: 'Cannot allocate from an empty or negative asset.' });

    // Calculate the new fraction
    const transactionFraction = amountNum / liveAssetValue;

    // Guardrail: Ensure we never exceed 100% of an asset's total value across all goals
    const existingAllocations = await prisma.goalAllocation.findMany({ where: { sourceId } });
    const totalAllocatedFraction = existingAllocations.reduce((sum, a) => sum + a.fractionalShare, 0);

    if (totalAllocatedFraction + transactionFraction > 1.0) {
      return res.status(400).json({ error: 'Data Integrity Block: Exceeds 100% of the asset pool.' });
    }

    // Update existing allocation or create a new one
    const existingGoalAlloc = await prisma.goalAllocation.findFirst({
      where: { goalId: id, sourceId }
    });

    if (existingGoalAlloc) {
      const newFraction = existingGoalAlloc.fractionalShare + transactionFraction;
      if (newFraction <= 0) {
        await prisma.goalAllocation.delete({ where: { id: existingGoalAlloc.id } });
      } else {
        await prisma.goalAllocation.update({
          where: { id: existingGoalAlloc.id },
          data: { fractionalShare: newFraction }
        });
      }
    } else {
      if (amountNum < 0) return res.status(400).json({ error: 'Cannot reclaim funds that do not exist.' });
      
      await prisma.goalAllocation.create({
        data: {
          goal: { connect: { id } }, // Ultra-safe Prisma relational connect
          sourceId,
          sourceType,
          fractionalShare: transactionFraction,
          lockedAtValue: amountNum
        }
      });
    }

    res.json({ message: 'Ledger updated successfully.' });
  } catch (error) {
    console.error('Transaction Error:', error);
    res.status(500).json({ error: 'Failed to process transaction.' });
  }
};

// 4. TOGGLE LOCK
export const toggleLock = async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked } = req.body;
    await prisma.goal.update({
      where: { id },
      data: { isLocked }
    });
    res.json({ message: 'Lock state updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lock state.' });
  }
};

// 5. DELETE GOAL
export const deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.goal.delete({ where: { id } });
    // Prisma Schema "onDelete: Cascade" automatically deletes associated GoalAllocations
    res.json({ message: 'Goal deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete goal.' });
  }
};