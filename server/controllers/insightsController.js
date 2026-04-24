import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const getUserId = (req) => {
  const id = req.user?.id || req.user?.userId || req.userId;
  return isNaN(Number(id)) ? id : Number(id); 
};

export const getPhase1Insights = async (req, res) => {
  try {
    const userId = getUserId(req);
    
    const now = new Date();
    const currM = now.getMonth(); const currY = now.getFullYear();
    const prevM = currM === 0 ? 11 : currM - 1; 
    const prevY = currM === 0 ? currY - 1 : currY;

    // Sequential Fetch to protect Connection Pool
    const subscriptions = await prisma.subscription.findMany({ where: { userId } });
    const bills = await prisma.recurringBill.findMany({ where: { userId } });
    const assets = await prisma.asset.findMany({ where: { userId } });
    const holdings = await prisma.holding.findMany({ where: { userId } });
    const transactions = await prisma.transaction.findMany({ where: { userId } });
    const passiveIncomes = await prisma.passiveIncome.findMany({ where: { userId } });
    const goals = await prisma.goal.findMany({ where: { userId }, include: { allocations: true } });

    // --- AUTOPILOT & RADAR ---
    let monthlyBurn = 0;
    subscriptions.forEach(sub => monthlyBurn += (sub.cycle === 'Yearly' ? sub.price / 12 : sub.price));
    bills.forEach(bill => {
      let amt = bill.amount;
      if (bill.frequency === 'Yearly') amt /= 12;
      if (bill.frequency === 'Quarterly') amt /= 3;
      monthlyBurn += amt;
    });

    const autopilotErosion = { oneYear: monthlyBurn * 12, fiveYear: monthlyBurn * 60, tenYear: monthlyBurn * 120 };

    let stableValue = 0, volatileValue = 0;
    goals.forEach(goal => {
      goal.allocations.forEach(alloc => {
        if (alloc.sourceType === 'ASSET') {
          const asset = assets.find(a => a.id === alloc.sourceId);
          if (asset) stableValue += (asset.currentValue * alloc.fractionalShare);
        } else if (alloc.sourceType === 'HOLDING') {
          const holding = holdings.find(h => h.id === alloc.sourceId);
          if (holding) volatileValue += (holding.quantity * holding.currentPrice * alloc.fractionalShare);
        }
      });
    });

    // --- BLUEPRINT (50/30/20) & CORE DATA ---
    const needsCategories = ['Housing', 'Food', 'Transportation', 'Utilities'];
    const wantsCategories = ['Entertainment', 'Other Expense'];
    
    const currMonthTxs = transactions.filter(t => t.date.getMonth() === currM && t.date.getFullYear() === currY);
    const prevMonthTxs = transactions.filter(t => t.date.getMonth() === prevM && t.date.getFullYear() === prevY);

    const currTxIncome = currMonthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const currPassiveIncome = passiveIncomes.filter(p => p.date.getMonth() === currM && p.date.getFullYear() === currY).reduce((sum, p) => sum + p.amount, 0);
    const totalMonthlyIncome = currTxIncome + currPassiveIncome;

    const needsTotal = currMonthTxs.filter(t => t.type === 'expense' && needsCategories.includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const wantsTotal = currMonthTxs.filter(t => t.type === 'expense' && wantsCategories.includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const savingsTotal = Math.max(0, totalMonthlyIncome - needsTotal - wantsTotal);

    // --- NEW DEEP ANALYTICS (SWOT V2) ---
    const totalEmergencyFunds = assets.filter(a => a.type === 'EMERGENCY').reduce((sum, a) => sum + a.currentValue, 0);
    const emergencyFundMonths = monthlyBurn > 0 ? (totalEmergencyFunds / monthlyBurn) : 0;
    
    // 1. Structural Weakness Ratio
    const fixedToIncomeRatio = totalMonthlyIncome > 0 ? (monthlyBurn / totalMonthlyIncome) : 0;
    
    // 2. Capital Efficiency (Strength)
    const savingsRate = totalMonthlyIncome > 0 ? (savingsTotal / totalMonthlyIncome) : 0;
    
    // 3. Inflation Drag (Opportunity)
    const liquidAssetsTotal = assets.filter(a => a.type === 'BANK' || a.type === 'CASH').reduce((sum, a) => sum + a.currentValue, 0);
    const unallocatedCash = Math.max(0, liquidAssetsTotal - stableValue);
    const INFLATION_RATE = 0.03; 
    const inflationDragAmount = unallocatedCash * INFLATION_RATE;

    // 4. Lifestyle Creep Velocity (Threat)
    const prevWantsTotal = prevMonthTxs.filter(t => t.type === 'expense' && wantsCategories.includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const prevTxIncome = prevMonthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const prevPassiveIncome = passiveIncomes.filter(p => p.date.getMonth() === prevM && p.date.getFullYear() === prevY).reduce((sum, p) => sum + p.amount, 0);
    const prevMonthlyIncome = prevTxIncome + prevPassiveIncome;

    const wantsVelocity = prevWantsTotal > 0 ? (wantsTotal - prevWantsTotal) / prevWantsTotal : 0;
    const incomeVelocity = prevMonthlyIncome > 0 ? (totalMonthlyIncome - prevMonthlyIncome) / prevMonthlyIncome : 0;
    const isLifestyleCreepActive = wantsVelocity > incomeVelocity && wantsVelocity > 0;

    // --- TIME-VALUE INDEX ---
    const activeIncomeCategories = ['Salary', 'Freelance'];
    const activeMonthlyIncome = currMonthTxs.filter(t => t.type === 'income' && activeIncomeCategories.includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
    const WORK_HOURS = 160;
    const trueHourlyRate = activeMonthlyIncome > 0 ? (activeMonthlyIncome / WORK_HOURS) : 0;

    const timeValueExpenses = currMonthTxs
      .filter(t => t.type === 'expense')
      .map(tx => ({
        id: tx.id, name: tx.name, category: tx.category, amount: tx.amount,
        costInHours: trueHourlyRate > 0 ? (tx.amount / trueHourlyRate) : 0
      }))
      .sort((a, b) => b.costInHours - a.costInHours).slice(0, 5);

    // --- LIFESTYLE CREEP CURVE ---
    const lifestyleCurve = [];
    for (let i = 5; i >= 0; i--) {
      let targetMonth = currM - i; let targetYear = currY;
      if (targetMonth < 0) { targetMonth += 12; targetYear -= 1; }
      const monthDate = new Date(targetYear, targetMonth, 1);
      const monthLabel = monthDate.toLocaleString('default', { month: 'short' });

      const txInc = transactions.filter(t => t.type === 'income' && t.date.getMonth() === targetMonth && t.date.getFullYear() === targetYear).reduce((s, t) => s + t.amount, 0);
      const passInc = passiveIncomes.filter(p => p.date.getMonth() === targetMonth && p.date.getFullYear() === targetYear).reduce((s, p) => s + p.amount, 0);
      
      const historicalWants = transactions.filter(t => t.type === 'expense' && wantsCategories.includes(t.category) && t.date.getMonth() === targetMonth && t.date.getFullYear() === targetYear).reduce((s, t) => s + t.amount, 0);
      const historicalIncome = txInc + passInc;

      lifestyleCurve.push({
        month: monthLabel, income: historicalIncome, wantsExpense: historicalWants,
        wealthGap: Math.max(0, historicalIncome - historicalWants)
      });
    }

    res.json({
      autopilotErosion,
      volatility: { stableValue, volatileValue, totalAllocated: stableValue + volatileValue },
      swot: { 
        emergencyFundMonths, 
        fixedToIncomeRatio, 
        unallocatedCash, 
        savingsRate, // NEW
        inflationDragAmount, // NEW
        isLifestyleCreepActive, // NEW
        wantsVelocity, // NEW
        incomeVelocity // NEW
      },
      blueprint: { income: totalMonthlyIncome, needs: needsTotal, wants: wantsTotal, savings: savingsTotal },
      timeValue: { activeIncome: activeMonthlyIncome, hourlyRate: trueHourlyRate, expenses: timeValueExpenses },
      lifestyleCurve
    });

  } catch (error) {
    console.error("Insights Error:", error);
    res.status(500).json({ error: "Failed to generate insights." });
  }
};