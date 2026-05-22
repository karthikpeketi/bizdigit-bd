const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ── Core identity ──────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    businessName: {
      type: String,
      required: function requiredBusinessName() {
        return this.role !== "admin";
      },
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["owner", "admin"],
      default: "owner",
    },
    // Optional field used by the admin dashboard flow.
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function defaultStatus() {
        return this.role === "admin" ? "approved" : "pending";
      },
      index: true,
    },
    // Login rate limiting
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },

    // ── Basic Information (optional — filled via profile edit) ────────────
    contactNumber: { type: String, trim: true, default: "" },
    businessEmail: { type: String, trim: true, lowercase: true, default: "" },
    businessType:  { type: String, trim: true, default: "" },
    businessAddress: { type: String, trim: true, default: "" },

    // ── Business Operations ───────────────────────────────────────────────
    dailyFootfall: {
      type: String,
      enum: ["", "Low", "Medium", "High"],
      default: "",
    },
    peakHours: {
      type: String,
      enum: ["", "Morning", "Afternoon", "Evening"],
      default: "",
    },
    workingDays: {
      type: [String],
      default: [],
    },
    targetAudience: {
      type: String,
      enum: ["", "Students", "Families", "Professionals", "Mixed"],
      default: "",
    },
    numberOfEmployees: {
      type: String,
      enum: ["", "Small", "Medium", "Large"],
      default: "",
    },

    // ── Digital Presence ──────────────────────────────────────────────────
    currentMarketing: {
      type: [String],
      default: [],
    },
    onlinePresence: {
      type: String,
      enum: ["", "Inactive", "Active", "Highly Active"],
      default: "",
    },
    websiteUrl:      { type: String, trim: true, default: "" },
    socialMediaLink: { type: String, trim: true, default: "" },

    // ── Payment Information ───────────────────────────────────────────────
    acceptsCardPayments: {
      type: String,
      enum: ["", "Yes", "No"],
      default: "",
    },
    acceptsCash: {
      type: String,
      enum: ["", "Yes", "No"],
      default: "",
    },
    monthlyTransactions: {
      type: String,
      enum: ["", "Low", "Medium", "High"],
      default: "",
    },
    averageOrderValue: {
      type: String,
      enum: ["", "Low", "Medium", "High"],
      default: "",
    },
    // ── Subscription Details ──────────────────────────────────────────────
    subscription: {
      plan: {
        type: String,
        enum: ["Free", "Starter", "Growth", "Scale"],
        default: "Free",
      },
      status: {
        type: String,
        enum: ["active", "expired", "cancelled", "none"],
        default: "active",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
      },
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

// Virtual to check if account is currently locked
userSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Increment failed login attempts, lock after 5
userSchema.methods.incrementLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  // Reset if lock already expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION_MS) };
  }
  return this.updateOne(updates);
};

// Clear login attempts on successful login
userSchema.methods.clearLoginAttempts = async function () {
  if (this.loginAttempts !== 0 || this.lockUntil != null) {
    return this.updateOne({
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    });
  }
};

module.exports = mongoose.model("User", userSchema);
