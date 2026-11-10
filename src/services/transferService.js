import crypto from "crypto";
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import Category from "../models/Category.js";
import { generateFingerprint } from "../utils/fingerprint.js";
import { logAudit } from "../utils/auditLogger.js";
import { getAccountBalanceDelta } from "../utils/accountBalance.js";

/**
 * Creates a linked transfer pair between two accounts
 */
export const createAccountTransfer = async (
  userId,
  { fromAccountId, toAccountId, amount, date, notes = "" }
) => {
  if (String(fromAccountId) === String(toAccountId)) {
    throw new Error("Source and destination accounts must be different.");
  }

  const [fromAccount, toAccount] = await Promise.all([
    Account.findOne({ _id: fromAccountId, userId }),
    Account.findOne({ _id: toAccountId, userId })
  ]);

  if (!fromAccount || !toAccount) {
    throw new Error("One or both accounts not found.");
  }

  const transferGroupId = `trf-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const transferDate = new Date(date || Date.now());

  const [outCategory, inCategory] = await Promise.all([
    getOrCreateTransferCategory(userId, "Self Transfer Out", "EXPENSE"),
    getOrCreateTransferCategory(userId, "Self Transfer In", "INCOME")
  ]);

  const sourceDesc = `Transfer to ${toAccount.name}`;
  const targetDesc = `Transfer from ${fromAccount.name}`;

  const sourceFp = generateFingerprint({
    accountId: fromAccountId,
    date: transferDate,
    amount,
    type: "EXPENSE",
    description: sourceDesc
  });

  const targetFp = generateFingerprint({
    accountId: toAccountId,
    date: transferDate,
    amount,
    type: "INCOME",
    description: targetDesc
  });

  const [sourceTxn, targetTxn] = await Promise.all([
    Transaction.create({
      userId,
      accountId: fromAccountId,
      date: transferDate,
      description: sourceDesc,
      amount,
      type: "EXPENSE",
      categoryId: outCategory._id,
      transferGroupId,
      fingerprint: sourceFp,
      source: "MANUAL",
      notes
    }),
    Transaction.create({
      userId,
      accountId: toAccountId,
      date: transferDate,
      description: targetDesc,
      amount,
      type: "INCOME",
      categoryId: inCategory._id,
      transferGroupId,
      fingerprint: targetFp,
      source: "MANUAL",
      notes
    })
  ]);

  // A card's balance is an outstanding liability, so a payment *to* a card
  // reduces it while card spending increases it.
  await Promise.all([
    Account.findByIdAndUpdate(fromAccountId, { $inc: { currentBalance: getAccountBalanceDelta(fromAccount.accountType, "EXPENSE", amount) } }),
    Account.findByIdAndUpdate(toAccountId, { $inc: { currentBalance: getAccountBalanceDelta(toAccount.accountType, "INCOME", amount) } })
  ]);

  await logAudit({
    userId,
    entityType: "TRANSFER",
    entityId: transferGroupId,
    action: "CREATE",
    after: { fromAccountId, toAccountId, amount, transferGroupId },
    reason: `Transfer of ₹${amount} from ${fromAccount.name} to ${toAccount.name}`
  });

  return { transferGroupId, sourceTxn, targetTxn };
};

/**
 * Links two existing imported or manual transactions as a transfer pair
 */
export const linkExistingTransactionsAsTransfer = async (
  userId,
  { firstTransactionId, secondTransactionId }
) => {
  const [first, second] = await Promise.all([
    Transaction.findOne({ _id: firstTransactionId, userId }),
    Transaction.findOne({ _id: secondTransactionId, userId })
  ]);

  if (!first || !second) throw new Error("One or both transactions not found.");
  if (String(first.accountId) === String(second.accountId)) {
    throw new Error("Transfers must be between two different accounts.");
  }

  const transferGroupId = `trf-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const [outCategory, inCategory] = await Promise.all([
    getOrCreateTransferCategory(userId, "Self Transfer Out", "EXPENSE"),
    getOrCreateTransferCategory(userId, "Self Transfer In", "INCOME")
  ]);
  const firstIsIncoming = first.type === "INCOME";
  first.type = firstIsIncoming ? "INCOME" : "EXPENSE";
  first.categoryId = firstIsIncoming ? inCategory._id : outCategory._id;
  first.transferGroupId = transferGroupId;
  second.type = firstIsIncoming ? "EXPENSE" : "INCOME";
  second.categoryId = firstIsIncoming ? outCategory._id : inCategory._id;
  second.transferGroupId = transferGroupId;

  await Promise.all([first.save(), second.save()]);

  await logAudit({
    userId,
    entityType: "TRANSFER",
    entityId: transferGroupId,
    action: "UPDATE",
    after: { firstTransactionId, secondTransactionId, transferGroupId },
    reason: "Linked existing transactions as transfer pair"
  });

  return { success: true, transferGroupId, first, second };
};

const getOrCreateTransferCategory = async (userId, name, type) =>
  Category.findOneAndUpdate(
    { userId, name, type },
    { $setOnInsert: { userId, name, type, color: "#3b82f6", icon: "arrow-left-right" } },
    { upsert: true, new: true }
  );
