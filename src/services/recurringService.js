import RecurringRule from "../models/RecurringRule.js";
import { createTransaction } from "./transactionService.js";

/**
 * Calculates next due date based on frequency
 */
export const calculateNextDate = (currentDate, frequency) => {
  const d = new Date(currentDate);
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
};

/**
 * List recurring rules for a user
 */
export const getRecurringRules = async (userId) => {
  return await RecurringRule.find({ userId })
    .populate("categoryId", "name type color icon")
    .populate("accountId", "name accountType")
    .sort({ nextDueDate: 1 });
};

/**
 * Get all rules currently due for execution (nextDueDate <= now)
 */
export const getDueRecurringRules = async (userId) => {
  const now = new Date();
  return await RecurringRule.find({
    userId,
    isActive: true,
    nextDueDate: { $lte: now }
  })
    .populate("categoryId", "name type color icon")
    .populate("accountId", "name accountType");
};

/**
 * Executes a recurring rule and advances its nextDueDate
 */
export const executeRecurringRule = async (userId, ruleId) => {
  const rule = await RecurringRule.findOne({ _id: ruleId, userId });
  if (!rule) throw new Error("Recurring rule not found");

  const txn = await createTransaction(userId, {
    date: rule.nextDueDate,
    description: rule.description,
    amount: rule.amount,
    type: rule.type,
    categoryId: rule.categoryId,
    accountId: rule.accountId,
    source: "RECURRING",
    notes: `Generated from recurring rule (${rule.frequency})`
  });

  rule.lastGeneratedDate = new Date();
  rule.nextDueDate = calculateNextDate(rule.nextDueDate, rule.frequency);
  await rule.save();

  return { transaction: txn, updatedRule: rule };
};

/**
 * Creates a recurring rule
 */
export const createRecurringRule = async (userId, data) => {
  return await RecurringRule.create({
    userId,
    ...data,
    nextDueDate: data.nextDueDate || data.startDate
  });
};

/**
 * Updates a recurring rule
 */
export const updateRecurringRule = async (userId, id, updates) => {
  const rule = await RecurringRule.findOneAndUpdate(
    { _id: id, userId },
    updates,
    { new: true }
  );
  if (!rule) throw new Error("Recurring rule not found");
  return rule;
};

/**
 * Deletes a recurring rule
 */
export const deleteRecurringRule = async (userId, id) => {
  const deleted = await RecurringRule.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new Error("Recurring rule not found");
  return deleted;
};
