import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
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
    accountType: {
      type: String,
      enum: ["BANK", "CASH", "CREDIT_CARD", "WALLET"],
      required: true
    },
    bankName: {
      type: String,
      trim: true,
      default: ""
    },
    accountNumberMasked: {
      type: String,
      trim: true,
      default: ""
    },
    openingBalance: {
      type: Number,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0
    },
    // BANK/CASH/WALLET balances are assets; credit-card balances are stored
    // as a positive outstanding liability.
    balanceSemantics: {
      type: String,
      enum: ["ASSET", "CARD_OUTSTANDING"],
      default: "ASSET"
    },
    lastStatementBalance: {
      type: Number,
      default: null
    },
    lastStatementBalanceDate: {
      type: Date,
      default: null
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

accountSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model("Account", accountSchema);
