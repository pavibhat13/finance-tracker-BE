import mongoose from "mongoose";

const importStagingSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportBatch",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true
    },
    rowNumber: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    rawDescription: {
      type: String,
      required: true
    },
    cleanDescription: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ["EXPENSE", "INCOME"],
      required: true
    },
    referenceId: {
      type: String,
      default: null
    },
    balanceAfter: {
      type: Number,
      default: null
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      default: null
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    fingerprint: {
      type: String,
      required: true
    },
    duplicateStatus: {
      type: String,
      enum: ["NONE", "EXACT_REFERENCE", "EXACT_FINGERPRINT", "POSSIBLE_DUPLICATE"],
      default: "NONE"
    },
    duplicateReason: {
      type: String,
      default: ""
    },
    matchedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null
    },
    included: {
      type: Boolean,
      default: true
    },
    isManuallyCategorized: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

importStagingSchema.index({ batchId: 1, rowNumber: 1 });
importStagingSchema.index({ userId: 1, fingerprint: 1 });

export default mongoose.model("ImportStaging", importStagingSchema);
