import Transaction from "../models/Transaction.js";
import Category from "../models/Category.js";
import { logAudit } from "../utils/auditLogger.js";

/**
 * Links a refund transaction to its original expense transaction
 */
export const linkRefundToPurchase = async (
  userId,
  { refundTransactionId, originalTransactionId }
) => {
  const [refundTxn, originalTxn] = await Promise.all([
    Transaction.findOne({ _id: refundTransactionId, userId }),
    Transaction.findOne({ _id: originalTransactionId, userId })
  ]);

  if (!refundTxn) throw new Error("Refund transaction not found.");
  if (!originalTxn) throw new Error("Original purchase transaction not found.");

  if (originalTxn.type !== "EXPENSE") {
    throw new Error("The target purchase transaction must be of type EXPENSE.");
  }

  // Calculate sum of existing refunds linked to this purchase (excluding the current refund if already linked)
  const existingRefunds = await Transaction.find({
    userId,
    linkedTransactionId: originalTxn._id,
    _id: { $ne: refundTxn._id },
    status: { $ne: "VOID" }
  });

  const existingRefundTotal = existingRefunds.reduce((sum, r) => sum + r.amount, 0);

  if (existingRefundTotal + refundTxn.amount > originalTxn.amount) {
    const maxAllowed = Math.max(0, originalTxn.amount - existingRefundTotal);
    throw new Error(
      `Total refund cannot exceed original purchase amount (₹${originalTxn.amount}). Max allowed refund is ₹${maxAllowed}.`
    );
  }

  // Update refund transaction
  refundTxn.type = "INCOME";
  refundTxn.linkedTransactionId = originalTxn._id;
  const refundCategory = await Category.findOneAndUpdate(
    { userId, name: "Online Refund", type: "INCOME" },
    { $setOnInsert: { userId, name: "Online Refund", type: "INCOME", color: "#8b5cf6", icon: "undo-2" } },
    { upsert: true, new: true }
  );
  refundTxn.categoryId = refundCategory._id;
  await refundTxn.save();

  await logAudit({
    userId,
    entityType: "REFUND",
    entityId: refundTxn._id,
    action: "UPDATE",
    after: {
      refundTransactionId,
      originalTransactionId,
      refundAmount: refundTxn.amount,
      originalAmount: originalTxn.amount
    },
    reason: `Linked refund of ₹${refundTxn.amount} to original expense of ₹${originalTxn.amount}`
  });

  return {
    success: true,
    refund: refundTxn,
    original: originalTxn,
    netExpenseRemaining: originalTxn.amount - (existingRefundTotal + refundTxn.amount)
  };
};

/**
 * Unlinks a refund from its original purchase
 */
export const unlinkRefund = async (userId, refundTransactionId) => {
  const refundTxn = await Transaction.findOne({ _id: refundTransactionId, userId });
  if (!refundTxn) throw new Error("Refund transaction not found.");

  refundTxn.linkedTransactionId = null;
  refundTxn.type = "INCOME"; // revert to general income
  await refundTxn.save();

  return refundTxn;
};
