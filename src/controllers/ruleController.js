import CategorizationRule from "../models/CategorizationRule.js";
import { learnRule } from "../services/categorizationService.js";

export const getRules = async (req, res, next) => {
  try {
    const rules = await CategorizationRule.find({ userId: req.user._id })
      .populate("categoryId", "name type color icon")
      .sort({ priority: 1, createdAt: -1 });
    res.json({ success: true, rules });
  } catch (error) {
    next(error);
  }
};

export const createRule = async (req, res, next) => {
  try {
    const { matchType, matchValue, categoryId, priority } = req.body;
    const rule = await CategorizationRule.create({
      userId: req.user._id,
      matchType: matchType || "CONTAINS",
      matchValue: matchValue.trim(),
      categoryId,
      priority: priority || 10
    });
    res.status(201).json({ success: true, rule });
  } catch (error) {
    next(error);
  }
};

export const updateRule = async (req, res, next) => {
  try {
    const rule = await CategorizationRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    res.json({ success: true, rule });
  } catch (error) {
    next(error);
  }
};

export const deleteRule = async (req, res, next) => {
  try {
    const rule = await CategorizationRule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    next(error);
  }
};

export const learnRuleFromCorrection = async (req, res, next) => {
  try {
    const { matchValue, categoryId, matchType } = req.body;
    const rule = await learnRule({
      userId: req.user._id,
      matchValue,
      categoryId,
      matchType
    });
    res.status(201).json({ success: true, rule });
  } catch (error) {
    next(error);
  }
};
