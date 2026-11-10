import {
  getBudgetsWithSpent,
  upsertBudget as saveBudget,
  updateBudget as editBudget,
  deleteBudget as removeBudget
} from "../services/budgetService.js";

export const getBudgets = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const result = await getBudgetsWithSpent(req.user._id, { month, year });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const createOrUpdateBudget = async (req, res, next) => {
  try {
    const { categoryId, month, year, limit } = req.body;
    const budget = await saveBudget(req.user._id, {
      categoryId,
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      limit: Number(limit)
    });
    res.status(201).json({ success: true, budget });
  } catch (error) {
    next(error);
  }
};

export const updateBudget = async (req, res, next) => {
  try {
    const { categoryId, limit, month, year } = req.body;
    const budget = await editBudget(req.user._id, req.params.id, {
      categoryId,
      limit: limit !== undefined ? Number(limit) : undefined,
      month,
      year
    });
    res.json({ success: true, budget });
  } catch (error) {
    next(error);
  }
};

export const deleteBudget = async (req, res, next) => {
  try {
    await removeBudget(req.user._id, req.params.id);
    res.json({ success: true, message: "Budget deleted" });
  } catch (error) {
    next(error);
  }
};
