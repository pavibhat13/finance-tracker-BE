import mongoose from "mongoose";

const recurringRuleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
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
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    frequency: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    nextDueDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastGeneratedDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

recurringRuleSchema.index({ userId: 1, isActive: 1, nextDueDate: 1 });

export default mongoose.model("RecurringRule", recurringRuleSchema);
