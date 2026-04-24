import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const getUserId = (req) => {
  const id = req.user?.id || req.user?.userId || req.userId;
  return isNaN(Number(id)) ? id : Number(id);
};

// 1. GET PREFERENCES & TAGS
export const getUserSettings = async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, currency: true, theme: true, categoryTags: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings." });
  }
};

// 2. UPDATE PREFERENCES (Currency & Theme)
export const updatePreferences = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { currency, theme } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        ...(currency && { currency }),
        ...(theme && { theme }) 
      },
      select: { currency: true, theme: true }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to update preferences." });
  }
};

// 3. CHANGE PASSWORD
export const changePassword = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: "Incorrect current password." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: "Password successfully updated." });
  } catch (error) {
    res.status(500).json({ error: "Failed to change password." });
  }
};

// 4. CUSTOM TAGS (Taxonomy Engine)
export const createCustomTag = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, type } = req.body; // type must be 'Needs', 'Wants', 'Savings', or 'Income'
    
    const tag = await prisma.categoryTag.create({
      data: { name, type, userId }
    });
    res.json(tag);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: "Tag already exists." });
    res.status(500).json({ error: "Failed to create custom tag." });
  }
};

export const deleteCustomTag = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await prisma.categoryTag.deleteMany({ where: { id, userId } });
    res.json({ message: "Tag deleted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tag." });
  }
};

// 5. ONE-CLICK EXPORT (CSV)
export const exportLedgerCSV = async (req, res) => {
  try {
    const userId = getUserId(req);
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });

    // Generate CSV Header
    let csvString = "Date,Name,Type,Category,Amount\n";
    
    // Map data to rows
    transactions.forEach(tx => {
      const date = new Date(tx.date).toISOString().split('T')[0];
      const name = `"${tx.name.replace(/"/g, '""')}"`; // Escape commas in names
      const type = tx.type;
      const category = tx.category;
      const amount = tx.amount;
      csvString += `${date},${name},${type},${category},${amount}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('CashCue_Ledger_Export.csv');
    res.send(csvString);
  } catch (error) {
    res.status(500).json({ error: "Failed to export data." });
  }
};

// 6. THE DANGER ZONE
export const purgeLedger = async (req, res) => {
  try {
    const userId = getUserId(req);
    // Deletes financial footprint but keeps User Profile, Password, and Settings
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.asset.deleteMany({ where: { userId } }),
      prisma.holding.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.subscription.deleteMany({ where: { userId } }),
      prisma.recurringBill.deleteMany({ where: { userId } }),
      prisma.debt.deleteMany({ where: { userId } }),
      prisma.budget.deleteMany({ where: { userId } }),
      prisma.passiveIncome.deleteMany({ where: { userId } })
    ]);
    res.json({ message: "Financial ledger wiped completely clean." });
  } catch (error) {
    res.status(500).json({ error: "Failed to purge ledger." });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = getUserId(req);
    // Because of onDelete: Cascade in your schema, this instantly wipes ALL related data perfectly.
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: "Account completely deleted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete account." });
  }
};