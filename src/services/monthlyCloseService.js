import MonthlyClose from "../models/MonthlyClose.js";
import Transaction from "../models/Transaction.js";
import AuditLog from "../models/AuditLog.js";
import { getDashboardSummary } from "./dashboardService.js";
import { logAudit } from "../utils/auditLogger.js";

/**
 * Gets monthly close status and pre-closing check diagnostics
 */
export const getMonthlyCloseStatus = async (userId, { month, year }) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const [closeRecord, summary, uncategorizedCount, auditLogs] = await Promise.all([
    MonthlyClose.findOne({ userId, month: m, year: y }),
    getDashboardSummary(userId, { month: m, year: y }),
    Transaction.countDocuments({
      userId,
      status: { $ne: "VOID" },
      date: { $gte: startOfMonth, $lte: endOfMonth },
      categoryId: null
    }),
    AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(20)
  ]);

  return {
    month: m,
    year: y,
    isClosed: closeRecord ? closeRecord.status === "CLOSED" : false,
    closeRecord,
    summary: {
      totalIncome: summary.totalIncome,
      totalExpenses: summary.grossExpenses,
      netExpenses: summary.netExpenses,
      netSavings: summary.netSavings,
      uncategorizedCount
    },
    auditLogs
  };
};

/**
 * Closes the month and locks editing
 */
export const closeMonth = async (userId, { month, year, reason = "Month end closing completed" }) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const summary = await getDashboardSummary(userId, { month: m, year: y });

  const record = await MonthlyClose.findOneAndUpdate(
    { userId, month: m, year: y },
    {
      status: "CLOSED",
      closedAt: new Date(),
      reason,
      summary: {
        totalIncome: summary.totalIncome,
        totalExpenses: summary.netExpenses,
        netSavings: summary.netSavings,
        uncategorizedCount: summary.uncategorizedCount
      }
    },
    { new: true, upsert: true }
  );

  await logAudit({
    userId,
    entityType: "MONTHLY_CLOSE",
    entityId: record._id,
    action: "CLOSE_MONTH",
    after: record.toObject(),
    reason: `Closed month ${m}/${y}: ${reason}`
  });

  return record;
};

/**
 * Reopens a closed month with mandatory audit reason
 */
export const reopenMonth = async (userId, { month, year, reason }) => {
  if (!reason || reason.trim().length < 5) {
    throw new Error("A valid reason (minimum 5 characters) is required to reopen a closed month.");
  }

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const record = await MonthlyClose.findOne({ userId, month: m, year: y });
  if (!record || record.status !== "CLOSED") {
    throw new Error("Month is not currently closed.");
  }

  const before = record.toObject();

  record.status = "OPEN";
  record.reopenedAt = new Date();
  record.reason = reason;
  await record.save();

  await logAudit({
    userId,
    entityType: "MONTHLY_CLOSE",
    entityId: record._id,
    action: "REOPEN_MONTH",
    before,
    after: record.toObject(),
    reason: `Reopened month ${m}/${y}: ${reason}`
  });

  return record;
};
