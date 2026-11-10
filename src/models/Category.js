import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["INCOME", "EXPENSE"],
      required: true
    },
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    color: {
      type: String,
      default: "#64748b"
    },
    icon: {
      type: String,
      default: "tag"
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

categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

export default mongoose.model("Category", categorySchema);
