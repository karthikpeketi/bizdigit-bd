const express = require("express");
const {
  createPaymentIntent,
  confirmPayment,
  simulatePayment,
  getMyPaymentHistory,
  getPaymentsByUserId,
  getPaymentById,
} = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// ── Owner routes ──────────────────────────────────────────────────────────────
// Create a Stripe PaymentIntent (card payments)
router.post("/create-intent", protect, authorize("owner"), createPaymentIntent);

// Confirm a payment after Stripe success callback
router.post("/confirm", protect, authorize("owner"), confirmPayment);

// Simulate non-card payments (UPI, Wallet, NetBanking, etc.)
router.post("/simulate", protect, authorize("owner"), simulatePayment);

// Owner: paginated payment history for the authenticated user
router.get("/my-history", protect, authorize("owner"), getMyPaymentHistory);

// ── Admin routes ──────────────────────────────────────────────────────────────
// Admin: fetch payment history for a given user
router.get("/by-user/:userId", protect, authorize("admin"), getPaymentsByUserId);

// ── Shared routes (owner sees own, admin sees any) ────────────────────────────
router.get("/:id", protect, authorize("owner", "admin"), getPaymentById);

// Legacy alias — keep backward compat with existing frontend
router.post("/create-payment-intent", protect, authorize("owner"), createPaymentIntent);

module.exports = router;
