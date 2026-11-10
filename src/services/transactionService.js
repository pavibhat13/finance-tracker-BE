import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import MonthlyClose from "../models/MonthlyClose.js";
import mongoose from "mongoose";
import { generateFingerprint } from "../utils/fingerprint.js";
import { logAudit } from "../utils/auditLogger.js";
import { getAccountBalanceDelta } from "../utils/accountBalance.js";

/**
 * Checks if a transaction date falls in a closed month
 */
export const checkMonthClosed = async (userId, date) => {
  const d = new Date(date);
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();

  const closed = await MonthlyClose.findOne({
    userId,
    month,
    year,
    status: "CLOSED"
  });

  if (closed) {
    throw new Error(`Transactions for ${month}/${year} are locked because this month is closed.`);
  }
};

/**
 * Lists transactions with rich filters and pagination
 */
export const getTransactions = async (userId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { userId };

  if (query.status) {
    filter.status = query.status;
  } else {
    filter.status = { $ne: "VOID" };
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.categoryId) {
    if (query.categoryId === "uncategorized") {
      filter.categoryId = null;
    } else {
      filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    }
  }

  if (query.accountId) {
    filter.accountId = new mongoose.Types.ObjectId(query.accountId);
  }

  // Date range filtering
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) {
      if (typeof query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.from.trim())) {
        filter.date.$gte = new Date(`${query.from.trim()}T00:00:00.000Z`);
      } else {
        filter.date.$gte = new Date(query.from);
      }
    }
    if (query.to) {
      if (typeof query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.to.trim())) {
        filter.date.$lte = new Date(`${query.to.trim()}T23:59:59.999Z`);
      } else {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }
  } else if (query.month && query.year) {
    const month = parseInt(query.month, 10);
    const year = parseInt(query.year, 10);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    filter.date = { $gte: start, $lte: end };
  } else if (query.year) {
    const year = parseInt(query.year, 10);
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    filter.date = { $gte: start, $lte: end };
  }

  // Text search
  if (query.search) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { description: regex },
      { notes: regex },
      { referenceId: regex }
    ];
  }

  const [transactions, total, totalsResult] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("categoryId", "name type color icon")
      .populate("accountId", "name accountType")
      .populate("merchantId", "name")
      .populate("linkedTransactionId", "date description amount"),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$type", "EXPENSE"] }, "$amount", 0]
            }
          },
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$type", "INCOME"] }, "$amount", 0]
            }
          },
          selfTransferOut: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$transferGroupId", null] },
                    { $eq: ["$type", "EXPENSE"] }
                  ]
                },
                "$amount",
                0
              ]
            }
          },
          selfTransferIn: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$transferGroupId", null] },
                    { $eq: ["$type", "INCOME"] }
                  ]
                },
                "$amount",
                0
              ]
            }
          }
        }
      }
    ])
  ]);

  const totals = totalsResult[0] || {};

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    totals: {
      debit: Math.round((totals.totalDebit || 0) * 100) / 100,
      credit: Math.round((totals.totalCredit || 0) * 100) / 100,
      selfTransferOut: Math.round((totals.selfTransferOut || 0) * 100) / 100,
      selfTransferIn: Math.round((totals.selfTransferIn || 0) * 100) / 100
    }
  };
};

/**
 * Creates a single transaction with balance reconciliation
 */
export const createTransaction = async (userId, data) => {
  await checkMonthClosed(userId, data.date);
  const account = await Account.findOne({ _id: data.accountId, userId });
  if (!account) throw new Error("Account not found");

  const fingerprint = generateFingerprint({
    accountId: data.accountId,
    date: data.date,
    amount: data.amount,
    type: data.type,
    description: data.description
  });

  const transaction = await Transaction.create({
    userId,
    ...data,
    fingerprint,
    source: data.source || "MANUAL",
    status: "ACTIVE"
  });

  // Reconcile account balance
  const delta = getAccountBalanceDelta(account.accountType, data.type, data.amount);

  if (delta !== 0) {
    await Account.findByIdAndUpdate(account._id, {
      $inc: { currentBalance: delta }
    });
  }

  await logAudit({
    userId,
    entityType: "TRANSACTION",
    entityId: transaction._id,
    action: "CREATE",
    after: transaction.toObject(),
    reason: "Created new transaction"
  });

  return transaction;
};

/**
 * Updates a transaction with monthly close check and audit logging
 */
export const updateTransaction = async (userId, id, updates) => {
  const transaction = await Transaction.findOne({ _id: id, userId });
  if (!transaction) throw new Error("Transaction not found");

  await checkMonthClosed(userId, transaction.date);
  if (updates.date) {
    await checkMonthClosed(userId, updates.date);
  }

  const before = transaction.toObject();
  const account = await Account.findOne({ _id: transaction.accountId, userId });
  if (!account) throw new Error("Account not found");

  // If amount or type changed, reconcile account balance delta
  const oldDelta = getAccountBalanceDelta(account.accountType, transaction.type, transaction.amount);

  const newType = updates.type || transaction.type;
  const newAmount = updates.amount !== undefined ? updates.amount : transaction.amount;
  const newDelta = getAccountBalanceDelta(account.accountType, newType, newAmount);

  const balanceAdjustment = newDelta - oldDelta;

  Object.assign(transaction, updates);

  if (updates.categoryId) {
    transaction.isManuallyCategorized = true;
  }

  transaction.fingerprint = generateFingerprint({
    accountId: transaction.accountId,
    date: transaction.date,
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description
  });

  await transaction.save();

  if (balanceAdjustment !== 0) {
    await Account.findByIdAndUpdate(transaction.accountId, {
      $inc: { currentBalance: balanceAdjustment }
    });
  }

  await logAudit({
    userId,
    entityType: "TRANSACTION",
    entityId: transaction._id,
    action: "UPDATE",
    before,
    after: transaction.toObject(),
    reason: updates.reason || "Updated transaction details"
  });

  return transaction;
};

/**
 * Voids a transaction (soft delete) and reverses account balance
 */
export const voidTransaction = async (userId, id, reason = "Voided by user") => {
  const transaction = await Transaction.findOne({ _id: id, userId });
  if (!transaction) throw new Error("Transaction not found");

  await checkMonthClosed(userId, transaction.date);

  const before = transaction.toObject();

  const account = await Account.findOne({ _id: transaction.accountId, userId });
  if (!account) throw new Error("Account not found");
  const reverseDelta = -getAccountBalanceDelta(account.accountType, transaction.type, transaction.amount);

  transaction.status = "VOID";
  await transaction.save();

  if (reverseDelta !== 0) {
    await Account.findByIdAndUpdate(transaction.accountId, {
      $inc: { currentBalance: reverseDelta }
    });
  }

  await logAudit({
    userId,
    entityType: "TRANSACTION",
    entityId: transaction._id,
    action: "VOID",
    before,
    after: transaction.toObject(),
    reason
  });

  return transaction;
};
