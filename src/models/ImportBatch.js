import mongoose from "mongoose";

const importBatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true
    },
    statementFormat: {
      type: String,
      enum: ["AUTO", "HDFC_BANK", "SBI_BANK", "HDFC_CREDIT_CARD", "GENERIC"],
      default: "AUTO"
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: [
        "UPLOADED",
        "PARSING",
        "REVIEW",
        "CONFIRMED",
        "CANCELLED",
        "FAILED"
      ],
      default: "UPLOADED",
      index: true
    },
    totalRows: {
      type: Number,
      default: 0
    },
    acceptedRows: {
      type: Number,
      default: 0
    },
    duplicateRows: {
      type: Number,
      default: 0
    },
    confirmedAt: {
      type: Date,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

importBatchSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("ImportBatch", importBatchSchema);
