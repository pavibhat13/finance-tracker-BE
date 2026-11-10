import mongoose from "mongoose";

const monthlyCloseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      required: true
    },
    closedAt: {
      type: Date,
      default: null
    },
    summary: {
      totalIncome: { type: Number, default: 0 },
      totalExpenses: { type: Number, default: 0 },
      netSavings: { type: Number, default: 0 },
      transactionCount: { type: Number, default: 0 },
      uncategorizedCount: { type: Number, default: 0 }
    },
    reopenedAt: {
      type: Date,
      default: null
    },
    reason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

monthlyCloseSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("MonthlyClose", monthlyCloseSchema);
