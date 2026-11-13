import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ["EXPENSE", "INCOME"],
      required: true,
      index: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true
    },
    paymentMethod: {
      type: String,
      default: "OTHER"
    },
    source: {
      type: String,
      enum: ["MANUAL", "IMPORT", "RECURRING"],
      default: "MANUAL",
      required: true
    },
    referenceId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    fingerprint: {
      type: String,
      index: true
    },
    linkedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
      index: true
    },
    transferGroupId: {
      type: String,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RECONCILED", "VOID"],
      default: "ACTIVE",
      index: true
    },
    notes: {
      type: String,
      default: ""
    },
    isManuallyCategorized: {
      type: Boolean,
      default: false
    },
    importBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportBatch",
      default: null
    },
    recurringRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecurringRule",
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for optimal performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, accountId: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, fingerprint: 1 });
transactionSchema.index({ userId: 1, referenceId: 1 }, { sparse: true });

export default mongoose.model("Transaction", transactionSchema);
