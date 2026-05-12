const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 900, // 15 minutes (900 seconds)
    },
  },
  {
    collection: "OTP", // User specified "document called OTP" / "OTP's document"
  }
);

module.exports = mongoose.model("OTP", otpSchema);
