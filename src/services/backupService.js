import Account from "../models/Account.js";
import Category from "../models/Category.js";
import Merchant from "../models/Merchant.js";
import CategorizationRule from "../models/CategorizationRule.js";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import RecurringRule from "../models/RecurringRule.js";
import MonthlyClose from "../models/MonthlyClose.js";
import { logAudit } from "../utils/auditLogger.js";

/**
 * Exports complete personal finance dataset as JSON
 */
export const exportDataJson = async (userId) => {
  const [
    accounts,
    categories,
    merchants,
    rules,
    transactions,
    budgets,
    recurring,
    monthlyCloses
  ] = await Promise.all([
    Account.find({ userId }),
    Category.find({ userId }),
    Merchant.find({ userId }),
    CategorizationRule.find({ userId }),
    Transaction.find({ userId }),
    Budget.find({ userId }),
    RecurringRule.find({ userId }),
    MonthlyClose.find({ userId })
  ]);

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    userId,
    data: {
      accounts,
      categories,
      merchants,
      rules,
      transactions,
      budgets,
      recurring,
      monthlyCloses
    }
  };
};

/**
 * Exports transactions as CSV string
 */
export const exportTransactionsCsv = async (userId) => {
  const txns = await Transaction.find({ userId, status: { $ne: "VOID" } })
    .sort({ date: -1 })
    .populate("categoryId", "name")
    .populate("accountId", "name");

  const headers = [
    "Date",
    "Description",
    "Amount",
    "Type",
    "Category",
    "Account",
    "ReferenceId",
    "PaymentMethod",
    "Source",
    "Notes"
  ];

  const rows = txns.map((t) => [
    t.date ? new Date(t.date).toISOString().split("T")[0] : "",
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.amount,
    t.type,
    t.categoryId ? `"${t.categoryId.name}"` : "Uncategorized",
    t.accountId ? `"${t.accountId.name}"` : "",
    `"${t.referenceId || ""}"`,
    t.paymentMethod || "",
    t.source || "",
    `"${(t.notes || "").replace(/"/g, '""')}"`
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
};

/**
 * Restores dataset from a validated backup payload
 */
export const restoreDataJson = async (userId, backupPayload) => {
  if (!backupPayload || !backupPayload.data) {
    throw new Error("Invalid backup file: Missing 'data' object.");
  }

  const { data } = backupPayload;

  // Validate presence of collections
  const counts = {
    accounts: 0,
    categories: 0,
    merchants: 0,
    rules: 0,
    transactions: 0,
    budgets: 0,
    recurring: 0
  };

  // Restore Categories
  if (Array.isArray(data.categories)) {
    for (const cat of data.categories) {
      await Category.findOneAndUpdate(
        { userId, name: cat.name, type: cat.type },
        { ...cat, userId },
        { upsert: true, new: true }
      );
      counts.categories++;
    }
  }

  // Restore Accounts
  if (Array.isArray(data.accounts)) {
    for (const acc of data.accounts) {
      await Account.findOneAndUpdate(
        { userId, name: acc.name },
        { ...acc, userId },
        { upsert: true, new: true }
      );
      counts.accounts++;
    }
  }

  // Restore Merchants
  if (Array.isArray(data.merchants)) {
    for (const m of data.merchants) {
      await Merchant.findOneAndUpdate(
        { userId, normalizedName: m.normalizedName },
        { ...m, userId },
        { upsert: true, new: true }
      );
      counts.merchants++;
    }
  }

  // Restore Rules
  if (Array.isArray(data.rules)) {
    for (const r of data.rules) {
      await CategorizationRule.findOneAndUpdate(
        { userId, matchValue: r.matchValue },
        { ...r, userId },
        { upsert: true, new: true }
      );
      counts.rules++;
    }
  }

  // Restore Transactions
  if (Array.isArray(data.transactions)) {
    for (const t of data.transactions) {
      if (t.fingerprint) {
        await Transaction.findOneAndUpdate(
          { userId, fingerprint: t.fingerprint },
          { ...t, userId },
          { upsert: true, new: true }
        );
        counts.transactions++;
      }
    }
  }

  // Restore Budgets
  if (Array.isArray(data.budgets)) {
    for (const b of data.budgets) {
      await Budget.findOneAndUpdate(
        { userId, categoryId: b.categoryId, month: b.month, year: b.year },
        { ...b, userId },
        { upsert: true, new: true }
      );
      counts.budgets++;
    }
  }

  await logAudit({
    userId,
    entityType: "BACKUP",
    entityId: "RESTORE",
    action: "RESTORE_BACKUP",
    after: counts,
    reason: "Restored application data from backup JSON"
  });

  return { success: true, restoredCounts: counts };
};
