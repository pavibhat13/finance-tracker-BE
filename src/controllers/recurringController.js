import {
  getRecurringRules,
  getDueRecurringRules,
  executeRecurringRule,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule
} from "../services/recurringService.js";

export const getRecurring = async (req, res, next) => {
  try {
    const rules = await getRecurringRules(req.user._id);
    res.json({ success: true, rules });
  } catch (error) {
    next(error);
  }
};

export const getDueRecurring = async (req, res, next) => {
  try {
    const dueRules = await getDueRecurringRules(req.user._id);
    res.json({ success: true, dueRules });
  } catch (error) {
    next(error);
  }
};

export const executeRecurring = async (req, res, next) => {
  try {
    const result = await executeRecurringRule(req.user._id, req.params.id);
    res.json({ success: true, message: "Recurring transaction executed", ...result });
  } catch (error) {
    next(error);
  }
};

export const createRecurring = async (req, res, next) => {
  try {
    const rule = await createRecurringRule(req.user._id, req.body);
    res.status(201).json({ success: true, rule });
  } catch (error) {
    next(error);
  }
};

export const updateRecurring = async (req, res, next) => {
  try {
    const rule = await updateRecurringRule(req.user._id, req.params.id, req.body);
    res.json({ success: true, rule });
  } catch (error) {
    next(error);
  }
};

export const deleteRecurring = async (req, res, next) => {
  try {
    await deleteRecurringRule(req.user._id, req.params.id);
    res.json({ success: true, message: "Recurring rule deleted" });
  } catch (error) {
    next(error);
  }
};
