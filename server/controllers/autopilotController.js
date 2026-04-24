import prisma from '../config/db.js';

// --- STRICT CATEGORY FUNNEL (Matches Dashboard exactly) ---
const PREDEFINED_EXPENSES = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Utilities', 'Borrowed From', 'Other Expense'];
const PREDEFINED_INCOME = ['Salary', 'Freelance', 'Investments', 'Lent To', 'Other Income'];

// Helper to calculate the next billing cycle
const calculateNextDate = (currentDate, cycleOrFrequency) => {
  const date = new Date(currentDate);
  if (cycleOrFrequency === 'Monthly') date.setMonth(date.getMonth() + 1);
  else if (cycleOrFrequency === 'Quarterly') date.setMonth(date.getMonth() + 3);
  else if (cycleOrFrequency === 'Yearly') date.setFullYear(date.getFullYear() + 1);
  return date;
};

// --- 1. FETCH ENDPOINT ---
export const getAutopilotData = async (req, res) => {
  try {
    const userId = req.user.id;
    const [subscriptions, bills, debts] = await Promise.all([
      prisma.subscription.findMany({ where: { userId }, orderBy: { nextPaymentDate: 'asc' } }),
      prisma.recurringBill.findMany({ where: { userId }, orderBy: { nextDueDate: 'asc' } }),
      prisma.debt.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    ]);
    res.status(200).json({ subscriptions, bills, debts });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 2. CREATION ENDPOINTS ---
export const addSubscription = async (req, res) => {
  try {
    const data = { ...req.body, userId: req.user.id, nextPaymentDate: new Date(req.body.nextPaymentDate), price: parseFloat(req.body.price) };
    const sub = await prisma.subscription.create({ data });
    res.status(201).json(sub);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const addBill = async (req, res) => {
  try {
    const data = { ...req.body, userId: req.user.id, nextDueDate: new Date(req.body.nextDueDate), amount: parseFloat(req.body.amount) };
    const bill = await prisma.recurringBill.create({ data });
    res.status(201).json(bill);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const addDebt = async (req, res) => {
  try {
    const data = { ...req.body, userId: req.user.id, totalAmount: parseFloat(req.body.totalAmount) };
    if (data.amountPaid) data.amountPaid = parseFloat(data.amountPaid);
    if (data.interestRate) data.interestRate = parseFloat(data.interestRate);
    
    if (data.dueDate && data.dueDate.trim() !== '') data.dueDate = new Date(data.dueDate);
    else delete data.dueDate; 
    
    const debt = await prisma.debt.create({ data });
    res.status(201).json(debt);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 3. DELETE ENDPOINT ---
export const deleteItem = async (req, res) => {
  const { type, id } = req.params; 
  try {
    if (type === 'sub') await prisma.subscription.delete({ where: { id } });
    if (type === 'bill') await prisma.recurringBill.delete({ where: { id } });
    if (type === 'debt') await prisma.debt.delete({ where: { id } });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 4. LOG PARTIAL DEBT PAYMENT (Dual Write Engine) ---
export const updateDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const amountPaid = parseFloat(req.body.amountPaid);
    const userId = req.user.id;

    // Prisma Transaction ensures BOTH actions succeed, or neither do.
    const updatedDebt = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id } });
      if (!debt || debt.userId !== userId) throw new Error("Debt not found");

      // 1. Write payment to the main Dashboard Ledger
      await tx.transaction.create({
        data: {
          name: `${debt.type === 'BORROWED' ? 'Paid' : 'Received'} - ${debt.personName}`,
          amount: amountPaid,
          type: debt.type === 'BORROWED' ? 'expense' : 'income',
          category: debt.type === 'BORROWED' ? 'Borrowed From' : 'Lent To',
          date: new Date(),
          userId
        }
      });

      // 2. Update Debt progress
      return await tx.debt.update({
        where: { id },
        data: { 
          amountPaid: debt.amountPaid + amountPaid,
          status: (debt.amountPaid + amountPaid) >= debt.totalAmount ? 'SETTLED' : 'ACTIVE'
        }
      });
    });

    res.status(200).json(updatedDebt);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 5. MANUAL APPROVAL ENGINE (Dual Write + Cycle Reset) ---
export const approveItem = async (req, res) => {
  const { type, id } = req.params;
  const userId = req.user.id;

  try {
    let updatedItem;
    await prisma.$transaction(async (tx) => {
      if (type === 'sub') {
        const sub = await tx.subscription.findUnique({ where: { id } });
        if (!sub || sub.userId !== userId) throw new Error("Not found");

        await tx.transaction.create({
          data: { name: sub.name, amount: sub.price, type: 'expense', date: new Date(), category: PREDEFINED_EXPENSES.includes(sub.category) ? sub.category : 'Other Expense', userId }
        });
        updatedItem = await tx.subscription.update({ where: { id }, data: { nextPaymentDate: calculateNextDate(sub.nextPaymentDate, sub.cycle) } });
      } 
      
      else if (type === 'bill') {
        const bill = await tx.recurringBill.findUnique({ where: { id } });
        if (!bill || bill.userId !== userId) throw new Error("Not found");

        await tx.transaction.create({
          data: { name: bill.name, amount: bill.amount, type: 'expense', date: new Date(), category: PREDEFINED_EXPENSES.includes(bill.category) ? bill.category : 'Other Expense', userId }
        });
        updatedItem = await tx.recurringBill.update({ where: { id }, data: { nextDueDate: calculateNextDate(bill.nextDueDate, bill.frequency) } });
      } 
      
      else if (type === 'debt') {
        const debt = await tx.debt.findUnique({ where: { id } });
        if (!debt || debt.userId !== userId) throw new Error("Not found");
        
        const remaining = debt.totalAmount - debt.amountPaid;
        await tx.transaction.create({
          data: { name: `Settled: ${debt.personName}`, amount: remaining, type: debt.type === 'BORROWED' ? 'expense' : 'income', category: debt.type === 'BORROWED' ? 'Borrowed From' : 'Lent To', date: new Date(), userId }
        });
        updatedItem = await tx.debt.update({ where: { id }, data: { amountPaid: debt.totalAmount, status: 'SETTLED' } });
      }
    });

    res.status(200).json(updatedItem);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

export const runAutoPayCron = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // 1. Process Bills
    const dueBills = await prisma.recurringBill.findMany({ where: { autoPay: true, nextDueDate: { lt: tomorrow } } });
    for (const bill of dueBills) {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({ data: { name: `Auto-Pay: ${bill.name}`, amount: bill.amount, type: 'expense', date: new Date(), category: PREDEFINED_EXPENSES.includes(bill.category) ? bill.category : 'Other Expense', userId: bill.userId } });
        await tx.recurringBill.update({ where: { id: bill.id }, data: { nextDueDate: calculateNextDate(bill.nextDueDate, bill.frequency) } });
      });
    }

    // 2. Process Subscriptions (NEW)
    const dueSubs = await prisma.subscription.findMany({ where: { autoPay: true, nextPaymentDate: { lt: tomorrow } } });
    for (const sub of dueSubs) {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({ data: { name: `Auto-Pay: ${sub.name}`, amount: sub.price, type: 'expense', date: new Date(), category: PREDEFINED_EXPENSES.includes(sub.category) ? sub.category : 'Other Expense', userId: sub.userId } });
        await tx.subscription.update({ where: { id: sub.id }, data: { nextPaymentDate: calculateNextDate(sub.nextPaymentDate, sub.cycle) } });
      });
    }
    
    console.log(`[Auto-Pay] Processed ${dueBills.length} bills and ${dueSubs.length} subscriptions.`);
  } catch (error) { console.error('[Auto-Pay] Error running cron:', error); }
};