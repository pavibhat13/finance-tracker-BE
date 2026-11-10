import mongoose from "mongoose";
import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";

/**
 * Returns budgets for a specific month/year with actual spent and status
 */
export const getBudgetsWithSpent = async (userId, { month, year }) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  // 1. Fetch configured budgets
  const budgets = await Budget.find({ userId, month: m, year: y }).populate(
    "categoryId",
    "name type color icon"
  );

  // 2. Fetch spending per category for this month
  const categorySpending = await Transaction.aggregate([
    {
      $match: {
        userId: userObjectId,
        status: { $ne: "VOID" },
        date: { $gte: startOfMonth, $lte: endOfMonth },
        type: "EXPENSE",
        transferGroupId: null,
        categoryId: { $ne: null }
      }
    },
    {
      $group: {
        _id: "$categoryId",
        expenses: {
          $sum: {
            $cond: [{ $eq: ["$type", "EXPENSE"] }, "$amount", 0]
          }
        },
      }
    }
  ]);

  const spentMap = new Map();
  categorySpending.forEach((cs) => {
    spentMap.set(String(cs._id), cs.expenses);
  });

  let totalBudget = 0;
  let totalSpent = 0;

  const resultBudgets = budgets.map((b) => {
    const catIdStr = b.categoryId ? String(b.categoryId._id) : "";
    const spent = spentMap.get(catIdStr) || 0;
    const remaining = b.limit - spent;
    const percentage = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;

    let alertStatus = "NORMAL";
    if (percentage > 100) alertStatus = "EXCEEDED";
    else if (percentage >= 85) alertStatus = "WARNING";

    totalBudget += b.limit;
    totalSpent += spent;

    return {
      _id: b._id,
      category: b.categoryId,
      month: b.month,
      year: b.year,
      limit: b.limit,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentage,
      alertStatus
    };
  });

  return {
    month: m,
    year: y,
    totalBudget: Math.round(totalBudget * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalRemaining: Math.round((totalBudget - totalSpent) * 100) / 100,
    budgets: resultBudgets
  };
};

/**
 * Creates or updates a category budget
 */
export const upsertBudget = async (userId, { categoryId, month, year, limit }) => {
  const budget = await Budget.findOneAndUpdate(
    { userId, categoryId, month, year },
    { limit },
    { new: true, upsert: true }
  ).populate("categoryId", "name type color icon");

  return budget;
};

/**
 * Updates an existing budget by ID
 */
export const updateBudget = async (userId, id, { categoryId, limit, month, year }) => {
  const budget = await Budget.findOne({ _id: id, userId });
  if (!budget) throw new Error("Budget not found");

  if (categoryId) budget.categoryId = categoryId;
  if (limit !== undefined) budget.limit = Number(limit);
  if (month !== undefined) budget.month = parseInt(month, 10);
  if (year !== undefined) budget.year = parseInt(year, 10);

  await budget.save();
  return budget.populate("categoryId", "name type color icon");
};

/**
 * Deletes a budget
 */
export const deleteBudget = async (userId, id) => {
  const deleted = await Budget.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new Error("Budget not found");
  return deleted;
};

