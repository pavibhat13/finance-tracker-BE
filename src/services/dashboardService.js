import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";

/**
 * Returns financial dashboard summary for a given month/year
 */
export const getDashboardSummary = async (userId, { month, year }) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  // Linked account transfers are excluded: they move money but are not income or spending.
  const totals = await Transaction.aggregate([
    {
      $match: {
        userId: userObjectId,
        status: { $ne: "VOID" },
        date: { $gte: startOfMonth, $lte: endOfMonth },
        transferGroupId: null
      }
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" }
      }
    }
  ]);

  let totalIncome = 0;
  let grossExpenses = 0;

  totals.forEach((item) => {
    if (item._id === "INCOME") totalIncome = item.total;
    if (item._id === "EXPENSE") grossExpenses = item.total;
  });

  const totalRefunds = 0;
  const netExpenses = grossExpenses;
  const netSavings = totalIncome - netExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100 * 10) / 10 : 0;

  // Total balance across active accounts
  const accounts = await Account.find({ userId, isActive: true });
  const totalBalance = accounts.reduce(
    (sum, acc) => sum + (acc.accountType === "CREDIT_CARD" ? -(acc.currentBalance || 0) : (acc.currentBalance || 0)),
    0
  );

  // Uncategorized transactions count
  const uncategorizedCount = await Transaction.countDocuments({
    userId,
    status: { $ne: "VOID" },
    date: { $gte: startOfMonth, $lte: endOfMonth },
    type: "EXPENSE",
    categoryId: null
  });

  // Recent transactions
  const recentTransactions = await Transaction.find({
    userId,
    status: { $ne: "VOID" }
  })
    .sort({ date: -1, createdAt: -1 })
    .limit(6)
    .populate("categoryId", "name type color icon")
    .populate("accountId", "name accountType");

  return {
    month: m,
    year: y,
    totalIncome: Math.round(totalIncome * 100) / 100,
    grossExpenses: Math.round(grossExpenses * 100) / 100,
    totalRefunds: Math.round(totalRefunds * 100) / 100,
    netExpenses: Math.round(netExpenses * 100) / 100,
    netSavings: Math.round(netSavings * 100) / 100,
    savingsRate,
    totalBalance: Math.round(totalBalance * 100) / 100,
    uncategorizedCount,
    accounts,
    recentTransactions
  };
};

/**
 * Returns month-by-month trends for the given year
 */
export const getMonthlyTrends = async (userId, year) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const y = parseInt(year, 10);

  const startOfYear = new Date(Date.UTC(y, 0, 1));
  const endOfYear = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));

  const monthlyData = await Transaction.aggregate([
    {
      $match: {
        userId: userObjectId,
        status: { $ne: "VOID" },
        date: { $gte: startOfYear, $lte: endOfYear },
        transferGroupId: null
      }
    },
    {
      $group: {
        _id: {
          month: { $month: "$date" },
          type: "$type"
        },
        total: { $sum: "$amount" }
      }
    }
  ]);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const result = monthNames.map((name, index) => {
    const monthNum = index + 1;
    let income = 0;
    let expense = 0;

    monthlyData.forEach((row) => {
      if (row._id.month === monthNum) {
        if (row._id.type === "INCOME") income = row.total;
        if (row._id.type === "EXPENSE") expense = row.total;
      }
    });

    const refund = 0;
    const netExpense = expense;
    const savings = income - netExpense;

    return {
      month: name,
      monthNum,
      income: Math.round(income),
      expense: Math.round(netExpense),
      grossExpense: Math.round(expense),
      refund: Math.round(refund),
      savings: Math.round(savings)
    };
  });

  return result;
};

/**
 * Returns category-wise spending breakdown for a month
 */
export const getCategoryBreakdown = async (userId, { month, year }) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const categoryTotals = await Transaction.aggregate([
    {
      $match: {
        userId: userObjectId,
        status: { $ne: "VOID" },
        date: { $gte: startOfMonth, $lte: endOfMonth },
        type: "EXPENSE",
        transferGroupId: null
      }
    },
    {
      $group: {
        _id: "$categoryId",
        total: { $sum: "$amount" },
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category"
      }
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  const totalSpent = categoryTotals.reduce((sum, c) => sum + c.total, 0);

  return categoryTotals.map((item) => {
    const name = item.category ? item.category.name : "Uncategorized";
    const color = item.category ? item.category.color : "#94a3b8";
    const percentage = totalSpent > 0 ? Math.round((item.total / totalSpent) * 100 * 10) / 10 : 0;

    return {
      categoryId: item._id,
      name,
      color,
      total: Math.round(item.total * 100) / 100,
      count: item.count,
      percentage
    };
  });
};

/**
 * Returns month-over-month comparison between current month and prior month
 */
export const getMonthComparison = async (userId, { month, year }) => {
  const current = await getDashboardSummary(userId, { month, year });

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const previous = await getDashboardSummary(userId, { month: prevMonth, year: prevYear });

  const calcDiff = (curr, prev) => {
    const diff = curr - prev;
    const percentage = prev > 0 ? Math.round((diff / prev) * 100 * 10) / 10 : 0;
    return { diff, percentage };
  };

  return {
    current: {
      month,
      year,
      income: current.totalIncome,
      netExpense: current.netExpenses,
      savings: current.netSavings
    },
    previous: {
      month: prevMonth,
      year: prevYear,
      income: previous.totalIncome,
      netExpense: previous.netExpenses,
      savings: previous.netSavings
    },
    comparison: {
      incomeChange: calcDiff(current.totalIncome, previous.totalIncome),
      expenseChange: calcDiff(current.netExpenses, previous.netExpenses),
      savingsChange: calcDiff(current.netSavings, previous.netSavings)
    }
  };
};
