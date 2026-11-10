import Transaction from "../models/Transaction.js";
import {
  getTransactions as listTransactions,
  createTransaction as addTransaction,
  updateTransaction as editTransaction,
  voidTransaction as cancelTransaction
} from "../services/transactionService.js";
import { getDashboardSummary } from "../services/dashboardService.js";

export const getTransactions = async (req, res, next) => {
  try {
    const result = await listTransactions(req.user._id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user._id })
      .populate("categoryId", "name type color icon")
      .populate("accountId", "name accountType")
      .populate("merchantId", "name")
      .populate("linkedTransactionId", "date description amount");

    if (!txn) return res.status(404).json({ success: false, message: "Transaction not found" });
    res.json({ success: true, transaction: txn });
  } catch (error) {
    next(error);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const transaction = await addTransaction(req.user._id, req.body);
    res.status(201).json({ success: true, transaction });
  } catch (error) {
    next(error);
  }
};

export const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await editTransaction(req.user._id, req.params.id, req.body);
    res.json({ success: true, transaction });
  } catch (error) {
    next(error);
  }
};

export const voidTransaction = async (req, res, next) => {
  try {
    const transaction = await cancelTransaction(
      req.user._id,
      req.params.id,
      req.body.reason || "Voided by user"
    );
    res.json({ success: true, message: "Transaction voided", transaction });
  } catch (error) {
    next(error);
  }
};

export const getTransactionSummary = async (req, res, next) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();
    const summary = await getDashboardSummary(req.user._id, { month, year });
    res.json({ success: true, summary });
  } catch (error) {
    next(error);
  }
};

export const bulkCategorizeTransactions = async (req, res, next) => {
  try {
    const { transactionIds, categoryId } = req.body;
    if (!Array.isArray(transactionIds) || !categoryId) {
      return res.status(400).json({ success: false, message: "Missing transactionIds or categoryId" });
    }

    const updated = await Transaction.updateMany(
      { _id: { $in: transactionIds }, userId: req.user._id },
      { categoryId, isManuallyCategorized: true }
    );

    res.json({
      success: true,
      message: `Updated ${updated.modifiedCount} transactions`,
      modifiedCount: updated.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};
