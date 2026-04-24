import prisma from '../config/db.js';

// 1. CREATE A TRANSACTION
export const createTransaction = async (req, res) => {
  try {
    const { name, amount, type, date, category } = req.body;

    const newTransaction = await prisma.transaction.create({
      data: {
        name,
        amount: parseFloat(amount),
        type,
        date: new Date(date), 
        category: category || 'General',
        userId: req.user.id, 
      },
    });

    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(500).json({ message: 'Error creating transaction', error: error.message });
  }
};

// 2. GET ALL TRANSACTIONS FOR A USER
export const getTransactions = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        date: 'desc', // Lets Postgres do the heavy lifting of sorting by newest!
      }
    });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

// 3. UPDATE A TRANSACTION
export const updateTransaction = async (req, res) => {
  try {
    const txId = req.params.id; // NO parseInt() because we use UUID Strings now!

    const transaction = await prisma.transaction.findUnique({
      where: { id: txId },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.userId !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to edit this' });
    }

    const updateData = { ...req.body };
    if (updateData.date) updateData.date = new Date(updateData.date);
    if (updateData.amount) updateData.amount = parseFloat(updateData.amount);

    const updatedTransaction = await prisma.transaction.update({
      where: { id: txId },
      data: updateData,
    });

    res.status(200).json(updatedTransaction);
  } catch (error) {
    res.status(500).json({ message: 'Error updating transaction', error: error.message });
  }
};

// 4. DELETE A TRANSACTION
export const deleteTransaction = async (req, res) => {
  try {
    const txId = req.params.id; // NO parseInt()

    const transaction = await prisma.transaction.findUnique({
      where: { id: txId },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.userId !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to delete this' });
    }

    await prisma.transaction.delete({
      where: { id: txId },
    });

    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction', error: error.message });
  }
};