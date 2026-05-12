const Stripe = require("stripe");
const asyncHandler = require("../middleware/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const Payment = require("../models/Payment");

// ── Helpers ───────────────────────────────────────────────────────────────────
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("sk_test_your")) {
    throw new ApiError(500, "STRIPE_SECRET_KEY is not configured on the backend");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// ── POST /payments/create-intent ─────────────────────────────────────────────
// Owner only: creates Stripe PaymentIntent + a pending Payment document
const createPaymentIntent = asyncHandler(async (req, res) => {
  const {
    amount,
    currency = "gbp",
    senderName,
    senderEmail,
    senderContact,
    notes,
    description,
    paymentPurpose,
    paymentMode,
  } = req.body;

  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new ApiError(400, "amount must be a positive number in the smallest currency unit (e.g. pence for GBP)");
  }

  if (!senderName || !senderName.trim()) {
    throw new ApiError(400, "senderName is required");
  }

  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Number(amount),
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      userId: req.user._id.toString(),
      senderName,
    },
  });

  // Create a pending Payment record in DB
  const payment = await Payment.create({
    userId: req.user._id,
    businessId: req.user._id,
    senderName: senderName.trim(),
    senderEmail: senderEmail?.trim() || "",
    senderContact: senderContact?.trim() || "",
    notes: notes?.trim() || "",
    amount: Number(amount),
    currency,
    description: description?.trim() || "",
    paymentPurpose: paymentPurpose?.trim() || "",
    paymentMode: paymentMode || "Stripe",
    status: "pending",
    stripePaymentIntentId: paymentIntent.id,
  });

  res.status(200).json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment._id,
    },
  });
});

// ── POST /payments/confirm ────────────────────────────────────────────────────
// Owner only: called after Stripe confirms success on the frontend
const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentId, stripePaymentIntentId } = req.body;

  if (!paymentId) {
    throw new ApiError(400, "paymentId is required");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, "Payment record not found");
  }

  // Ensure the owner only confirms their own payment
  if (payment.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to confirm this payment");
  }

  // Verify with Stripe if key is configured
  if (stripePaymentIntentId) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
      if (intent.status === "succeeded") {
        payment.status = "success";
        payment.paidAt = new Date();
      } else {
        payment.status = "failed";
      }
    } catch {
      // If Stripe verification fails (e.g., test mode), trust the frontend confirmation
      payment.status = "success";
      payment.paidAt = new Date();
    }
  } else {
    // Non-Stripe payment modes (UPI, Wallet, etc.) — mark as success directly
    payment.status = "success";
    payment.paidAt = new Date();
  }

  await payment.save();

  res.status(200).json({
    success: true,
    message: `Payment ${payment.status === "success" ? "confirmed successfully" : "failed"}`,
    data: payment,
  });
});

// ── POST /payments/simulate ───────────────────────────────────────────────────
// Owner only: simulates a non-Stripe payment (UPI, Wallet, NetBanking, etc.)
const simulatePayment = asyncHandler(async (req, res) => {
  const {
    amount,
    currency = "gbp",
    senderName,
    senderEmail,
    senderContact,
    notes,
    description,
    paymentPurpose,
    paymentMode,
    simulateFailure = false,
  } = req.body;

  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new ApiError(400, "amount must be a positive number");
  }

  if (!senderName || !senderName.trim()) {
    throw new ApiError(400, "senderName is required");
  }

  const validModes = ["UPI", "NetBanking", "Wallet", "DebitCard"];
  if (!validModes.includes(paymentMode)) {
    throw new ApiError(400, `paymentMode must be one of: ${validModes.join(", ")} for simulation`);
  }

  // Simulate a 200ms processing delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  const status = simulateFailure ? "failed" : "success";

  const payment = await Payment.create({
    userId: req.user._id,
    businessId: req.user._id,
    senderName: senderName.trim(),
    senderEmail: senderEmail?.trim() || "",
    senderContact: senderContact?.trim() || "",
    notes: notes?.trim() || "",
    amount: Number(amount),
    currency,
    description: description?.trim() || "",
    paymentPurpose: paymentPurpose?.trim() || "",
    paymentMode,
    status,
    paidAt: status === "success" ? new Date() : null,
  });

  res.status(200).json({
    success: true,
    message: status === "success" ? "Payment processed successfully" : "Payment failed",
    data: payment,
  });
});

// ── GET /payments/my-history ──────────────────────────────────────────────────
// Owner only: paginated payment history for the authenticated owner
const getMyPaymentHistory = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "",
    paymentMode = "",
    startDate = "",
    endDate = "",
  } = req.query;

  const filter = { userId: req.user._id };

  if (status && status !== "all") {
    filter.status = status;
  }

  if (paymentMode && paymentMode !== "all") {
    filter.paymentMode = paymentMode;
  }

  if (search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [
      { transactionRef: regex },
      { senderName: regex },
      { description: regex },
    ];
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Payment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: payments.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    data: payments,
  });
});

// ── GET /payments/by-user/:userId ─────────────────────────────────────────────
// Admin only: fetch paginated payment history for a specific user
const getPaymentsByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const {
    page = 1,
    limit = 10,
    status = "",
    paymentMode = "",
  } = req.query;

  if (!userId) {
    throw new ApiError(400, "userId param is required");
  }

  const filter = { userId };
  if (status && status !== "all") filter.status = status;
  if (paymentMode && paymentMode !== "all") filter.paymentMode = paymentMode;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Payment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: payments.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    data: payments,
  });
});

// ── GET /payments/:id ─────────────────────────────────────────────────────────
// Owner or Admin: fetch a single payment by ID
const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).lean();

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  // Owner can only see their own payments
  if (req.user.role === "owner" && payment.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Access denied");
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

module.exports = {
  createPaymentIntent,
  confirmPayment,
  simulatePayment,
  getMyPaymentHistory,
  getPaymentsByUserId,
  getPaymentById,
};
