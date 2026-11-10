import mongoose from "mongoose";

const categorizationRuleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    matchType: {
      type: String,
      enum: ["EXACT", "CONTAINS", "STARTS_WITH", "REGEX"],
      default: "CONTAINS",
      required: true
    },
    matchValue: {
      type: String,
      required: true,
      trim: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },
    priority: {
      type: Number,
      default: 10
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

categorizationRuleSchema.index({ userId: 1, priority: 1 });

export default mongoose.model("CategorizationRule", categorizationRuleSchema);
