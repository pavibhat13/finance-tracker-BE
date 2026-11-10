import Category from "../models/Category.js";
import Account from "../models/Account.js";
import CategorizationRule from "../models/CategorizationRule.js";

export const seedInitialUserData = async (userId) => {
  // 1. Seed Categories
  const defaultCategories = [
    // Expenses
    { name: "Food & Dining", type: "EXPENSE", color: "#f97316", icon: "utensils" },
    { name: "Groceries", type: "EXPENSE", color: "#10b981", icon: "shopping-cart" },
    { name: "Shopping", type: "EXPENSE", color: "#ec4899", icon: "shopping-bag" },
    { name: "Transportation", type: "EXPENSE", color: "#3b82f6", icon: "car" },
    { name: "Rent & Housing", type: "EXPENSE", color: "#8b5cf6", icon: "home" },
    { name: "Utilities & Bills", type: "EXPENSE", color: "#06b6d4", icon: "zap" },
    { name: "Entertainment", type: "EXPENSE", color: "#f43f5e", icon: "film" },
    { name: "Healthcare", type: "EXPENSE", color: "#ef4444", icon: "heart-pulse" },
    { name: "Travel", type: "EXPENSE", color: "#eab308", icon: "plane" },
    { name: "Personal Care", type: "EXPENSE", color: "#14b8a6", icon: "smile" },
    { name: "Self Transfer Out", type: "EXPENSE", color: "#3b82f6", icon: "arrow-up-right" },
    { name: "Money Lent", type: "EXPENSE", color: "#f59e0b", icon: "hand-coins" },
    // Income
    { name: "Salary", type: "INCOME", color: "#22c55e", icon: "briefcase" },
    { name: "Interest & Investments", type: "INCOME", color: "#059669", icon: "trending-up" },
    { name: "Cashback & Refunds", type: "INCOME", color: "#84cc16", icon: "gift" },
    { name: "Online Refund", type: "INCOME", color: "#8b5cf6", icon: "undo-2" },
    { name: "Self Transfer In", type: "INCOME", color: "#3b82f6", icon: "arrow-down-left" },
    { name: "Loan Repaid", type: "INCOME", color: "#06b6d4", icon: "hand-coins" },
    { name: "Other Income", type: "INCOME", color: "#64748b", icon: "plus-circle" }
  ];

  const createdCategories = {};
  for (const cat of defaultCategories) {
    const doc = await Category.findOneAndUpdate(
      { userId, name: cat.name, type: cat.type },
      { ...cat, userId },
      { upsert: true, new: true }
    );
    createdCategories[cat.name] = doc._id;
  }

  // 2. Seed Default Accounts (e.g. HDFC Bank, SBI Bank, HDFC Credit Card, Cash)
  const defaultAccounts = [
    { name: "HDFC Bank (Salary)", accountType: "BANK", bankName: "HDFC", openingBalance: 25000, currentBalance: 25000 },
    { name: "SBI Savings", accountType: "BANK", bankName: "SBI", openingBalance: 10000, currentBalance: 10000 },
    { name: "HDFC Millennia Credit Card", accountType: "CREDIT_CARD", bankName: "HDFC", openingBalance: 0, currentBalance: 0, balanceSemantics: "CARD_OUTSTANDING" },
    { name: "Cash Wallet", accountType: "CASH", openingBalance: 2000, currentBalance: 2000 }
  ];

  for (const acc of defaultAccounts) {
    await Account.findOneAndUpdate(
      { userId, name: acc.name },
      { ...acc, userId },
      { upsert: true, new: true }
    );
  }

  // 3. Seed Default Categorization Rules
  const defaultRules = [
    { matchValue: "SWIGGY", categoryName: "Food & Dining", priority: 1 },
    { matchValue: "ZOMATO", categoryName: "Food & Dining", priority: 1 },
    { matchValue: "BIGBASKET", categoryName: "Groceries", priority: 2 },
    { matchValue: "BLINKIT", categoryName: "Groceries", priority: 2 },
    { matchValue: "INSTAMART", categoryName: "Groceries", priority: 2 },
    { matchValue: "AMAZON", categoryName: "Shopping", priority: 3 },
    { matchValue: "FLIPKART", categoryName: "Shopping", priority: 3 },
    { matchValue: "UBER", categoryName: "Transportation", priority: 4 },
    { matchValue: "OLA", categoryName: "Transportation", priority: 4 },
    { matchValue: "NETFLIX", categoryName: "Entertainment", priority: 5 },
    { matchValue: "SPOTIFY", categoryName: "Entertainment", priority: 5 },
    { matchValue: "SALARY", categoryName: "Salary", priority: 6 }
  ];

  for (const rule of defaultRules) {
    const catId = createdCategories[rule.categoryName];
    if (catId) {
      await CategorizationRule.findOneAndUpdate(
        { userId, matchValue: rule.matchValue },
        {
          userId,
          matchType: "CONTAINS",
          matchValue: rule.matchValue,
          categoryId: catId,
          priority: rule.priority,
          isActive: true
        },
        { upsert: true, new: true }
      );
    }
  }

  return { success: true };
};
