import prisma from '../config/db.js';

// 1. CREATE A BUDGET LIMIT
export const createBudget = async (req, res) => {
  try {
    const { category, limit } = req.body;

    // Check if user already has a budget for this category
    const existing = await prisma.budget.findFirst({
      where: { userId: req.user.id, category }
    });

    if (existing) {
      return res.status(400).json({ message: 'A budget for this category already exists.' });
    }

    const newBudget = await prisma.budget.create({
      data: {
        category,
        limit: parseFloat(limit),
        userId: req.user.id,
      },
    });

    res.status(201).json(newBudget);
  } catch (error) {
    res.status(500).json({ message: 'Error creating budget', error: error.message });
  }
};

// 2. GET ALL BUDGETS
export const getBudgets = async (req, res) => {
  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.user.id },
      orderBy: { limit: 'desc' } // Sorts largest budgets to the top
    });

    res.status(200).json(budgets);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching budgets', error: error.message });
  }
};

// 3. DELETE A BUDGET
export const deleteBudget = async (req, res) => {
  try {
    const budgetId = req.params.id; // UUID String

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget || budget.userId !== req.user.id) {
      return res.status(404).json({ message: 'Budget not found or unauthorized' });
    }

    await prisma.budget.delete({
      where: { id: budgetId },
    });

    res.status(200).json({ message: 'Budget removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting budget', error: error.message });
  }
};