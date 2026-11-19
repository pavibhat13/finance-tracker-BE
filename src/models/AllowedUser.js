import mongoose from "mongoose";

const allowedUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    role: {
      type: String,
      enum: ["ADMIN", "USER"],
      default: "USER"
    },
    status: {
      type: String,
      enum: ["PENDING", "REGISTERED", "DEACTIVATED"],
      default: "PENDING"
    },
    registeredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("AllowedUser", allowedUserSchema);
