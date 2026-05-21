const mongoose = require("mongoose");
const crypto = require("crypto");

/**
 * Payment — persists a completed or attempted payment for a business owner.
 * Referenced by userId (owner) and businessId for admin views.
 */
const paymentSchema = new mongoose.Schema(
  {
    // ── Business / Owner Reference ────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      index: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // ── Sender Information ────────────────────────────────────────────────
    senderName: {
      type: String,
      trim: true,
      default: "",
    },
    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    senderContact: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Payment Details ───────────────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, "amount is required"],
      min: [0, "amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "gbp",
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    paymentPurpose: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMode: {
      type: String,
      enum: ["UPI", "CreditCard", "DebitCard", "NetBanking", "Wallet", "Stripe", ""],
      default: "",
    },

    // ── Status & References ───────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },
    transactionRef: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Audit ─────────────────────────────────────────────────────────────
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for history queries: filter by userId, sort by createdAt DESC
paymentSchema.index({ userId: 1, createdAt: -1 });

// Auto-generate a unique transactionRef before saving if not set
paymentSchema.pre("save", function (next) {
  if (!this.transactionRef) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    this.transactionRef = `TXN-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);
