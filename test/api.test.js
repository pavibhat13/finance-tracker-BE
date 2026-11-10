import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Account from "../src/models/Account.js";
import Category from "../src/models/Category.js";
import Merchant from "../src/models/Merchant.js";
import Transaction from "../src/models/Transaction.js";
import { seedInitialUserData } from "../src/services/seedService.js";
import { createTransaction, voidTransaction, getTransactions } from "../src/services/transactionService.js";
import { linkRefundToPurchase } from "../src/services/refundService.js";
import { createAccountTransfer } from "../src/services/transferService.js";
import { closeMonth, reopenMonth } from "../src/services/monthlyCloseService.js";
import { upsertBudget, updateBudget, getBudgetsWithSpent } from "../src/services/budgetService.js";

const TEST_MONGO_URI = "mongodb://127.0.0.1:27017/personal_finance_manager_test";

test.before(async () => {
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("User setup and seed initialization", async () => {
  const user = await User.create({
    name: "Aadarsh Test",
    email: "test@finance.local",
    password: "Password123!"
  });

  await seedInitialUserData(user._id);

  const categories = await Category.find({ userId: user._id });
  assert.ok(categories.length >= 10, "Default categories should be seeded");

  const accounts = await Account.find({ userId: user._id });
  assert.ok(accounts.length >= 3, "HDFC, SBI, and Card accounts should be seeded");
});

test("Transaction lifecycle and Account balance reconciliation", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const account = await Account.findOne({ userId: user._id, bankName: "HDFC" });
  const initialBal = account.currentBalance;

  // Add Expense
  const txn = await createTransaction(user._id, {
    date: new Date("2026-11-05"),
    description: "Swiggy Dinner",
    amount: 500,
    type: "EXPENSE",
    accountId: account._id
  });

  const accAfterExpense = await Account.findById(account._id);
  assert.equal(accAfterExpense.currentBalance, initialBal - 500);

  // Void transaction
  await voidTransaction(user._id, txn._id, "Accidental duplicate");
  const accAfterVoid = await Account.findById(account._id);
  assert.equal(accAfterVoid.currentBalance, initialBal, "Voiding must restore account balance");
});

test("Refund linking prevents refund exceeding original purchase", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const account = await Account.findOne({ userId: user._id });

  // Original purchase of 2000
  const original = await createTransaction(user._id, {
    date: new Date("2026-11-02"),
    description: "Zara Shopping",
    amount: 2000,
    type: "EXPENSE",
    accountId: account._id
  });

  // Valid partial refund of 500
  const refund1 = await createTransaction(user._id, {
    date: new Date("2026-11-06"),
    description: "Zara Partial Refund",
    amount: 500,
    type: "INCOME",
    accountId: account._id
  });

  const linkRes = await linkRefundToPurchase(user._id, {
    refundTransactionId: refund1._id,
    originalTransactionId: original._id
  });

  assert.equal(linkRes.netExpenseRemaining, 1500);

  // Attempting an invalid refund exceeding remaining 1500
  const excessiveRefund = await createTransaction(user._id, {
    date: new Date("2026-11-08"),
    description: "Excessive Refund",
    amount: 1800,
    type: "INCOME",
    accountId: account._id
  });

  await assert.rejects(
    async () => {
      await linkRefundToPurchase(user._id, {
        refundTransactionId: excessiveRefund._id,
        originalTransactionId: original._id
      });
    },
    /Total refund cannot exceed original purchase amount/,
    "Refund exceeding original purchase must be rejected"
  );
});

test("Transfers between accounts", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const [hdfc, sbi] = await Account.find({ userId: user._id, accountType: "BANK" });

  const hdfcBalBefore = hdfc.currentBalance;
  const sbiBalBefore = sbi.currentBalance;

  const result = await createAccountTransfer(user._id, {
    fromAccountId: hdfc._id,
    toAccountId: sbi._id,
    amount: 5000,
    date: new Date("2026-11-10"),
    notes: "Monthly savings transfer"
  });

  assert.ok(result.transferGroupId);
  assert.equal(result.sourceTxn.type, "EXPENSE");
  assert.equal(result.sourceTxn.categoryId.toString(), (await Category.findOne({ userId: user._id, name: "Self Transfer Out" }))._id.toString());
  assert.equal(result.targetTxn.type, "INCOME");
  assert.equal(result.targetTxn.categoryId.toString(), (await Category.findOne({ userId: user._id, name: "Self Transfer In" }))._id.toString());

  const hdfcAfter = await Account.findById(hdfc._id);
  const sbiAfter = await Account.findById(sbi._id);

  assert.equal(hdfcAfter.currentBalance, hdfcBalBefore - 5000);
  assert.equal(sbiAfter.currentBalance, sbiBalBefore + 5000);
});

test("Credit-card balances track outstanding amounts", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const card = await Account.findOne({ userId: user._id, accountType: "CREDIT_CARD" });

  await createTransaction(user._id, {
    date: new Date("2026-11-11"),
    description: "Card purchase",
    amount: 1200,
    type: "EXPENSE",
    accountId: card._id
  });
  assert.equal((await Account.findById(card._id)).currentBalance, 1200);

  await createTransaction(user._id, {
    date: new Date("2026-11-12"),
    description: "Card payment",
    amount: 500,
    type: "INCOME",
    accountId: card._id
  });
  assert.equal((await Account.findById(card._id)).currentBalance, 700);
});

test("Monthly Close locks transaction creation and edits", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const account = await Account.findOne({ userId: user._id });

  // Close October 2026
  await closeMonth(user._id, { month: 10, year: 2026, reason: "October closed" });

  // Adding transaction in October 2026 should be rejected
  await assert.rejects(
    async () => {
      await createTransaction(user._id, {
        date: new Date("2026-10-15"),
        description: "Late entry",
        amount: 200,
        type: "EXPENSE",
        accountId: account._id
      });
    },
    /are locked because this month is closed/
  );

  // Reopen October with reason
  await reopenMonth(user._id, { month: 10, year: 2026, reason: "Adjustment needed for tax invoice" });

  // Now adding is allowed
  const txn = await createTransaction(user._id, {
    date: new Date("2026-10-15"),
    description: "Late entry after reopen",
    amount: 200,
    type: "EXPENSE",
    accountId: account._id
  });

  assert.ok(txn._id);
});

test("Budget creation and edit update", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const category = await Category.findOne({ userId: user._id, type: "EXPENSE" });

  // Create budget
  const budget = await upsertBudget(user._id, {
    categoryId: category._id,
    month: 11,
    year: 2026,
    limit: 5000
  });
  assert.equal(budget.limit, 5000);

  // Edit budget limit to 7500
  const updated = await updateBudget(user._id, budget._id, {
    limit: 7500
  });
  assert.equal(updated.limit, 7500);

  const res = await getBudgetsWithSpent(user._id, { month: 11, year: 2026 });
  const found = res.budgets.find((b) => String(b._id) === String(budget._id));
  assert.equal(found?.limit, 7500);
});

test("Transaction date range filtering (From and To dates)", async () => {
  const user = await User.findOne({ email: "test@finance.local" });
  const account = await Account.findOne({ userId: user._id });

  await createTransaction(user._id, {
    date: new Date("2026-06-05T00:00:00.000Z"),
    description: "June transaction",
    amount: 150,
    type: "EXPENSE",
    accountId: account._id
  });

  await createTransaction(user._id, {
    date: new Date("2026-06-20T00:00:00.000Z"),
    description: "June mid transaction",
    amount: 250,
    type: "EXPENSE",
    accountId: account._id
  });

  await createTransaction(user._id, {
    date: new Date("2026-07-02T00:00:00.000Z"),
    description: "July transaction",
    amount: 350,
    type: "EXPENSE",
    accountId: account._id
  });

  // Filter with from and to covering only 2026-06-01 to 2026-06-25
  const result = await getTransactions(user._id, {
    from: "2026-06-01",
    to: "2026-06-25"
  });

  assert.equal(result.transactions.length, 2);
  const descriptions = result.transactions.map((t) => t.description);
  assert.ok(descriptions.includes("June transaction"));
  assert.ok(descriptions.includes("June mid transaction"));
  assert.ok(!descriptions.includes("July transaction"));
});

test("User can change password", async () => {
  const user = await User.findOne({ email: "test@finance.local" });

  const matchOld = await user.comparePassword("Password123!");
  assert.equal(matchOld, true);

  user.password = "NewStrongPassword456*";
  await user.save();

  const updatedUser = await User.findById(user._id);
  const matchNew = await updatedUser.comparePassword("NewStrongPassword456*");
  assert.equal(matchNew, true);
  const matchOldFail = await updatedUser.comparePassword("Password123!");
  assert.equal(matchOldFail, false);
});

