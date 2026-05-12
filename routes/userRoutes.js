const express = require("express");
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateOwnProfile,
  deleteUser,
  updateUserStatus,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
const User = require("../models/User");
const Payment = require("../models/Payment");

router.get("/seed-pixelstack", async (req, res) => {
  const PIXELSTACK_ID = '6a021bad469a45a8d72cf1b3';
  try {
    // 1. Update Business Profile
    const updatedUser = await User.findByIdAndUpdate(
      PIXELSTACK_ID,
      {
        $set: {
          contactNumber: "+44 20 7946 0123",
          businessEmail: "hello@pixelstack.uk",
          businessType: "Software Development",
          businessAddress: "128 City Road, London, EC1V 2NX, UK",
          dailyFootfall: "Low",
          peakHours: "Afternoon",
          workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          targetAudience: "Professionals",
          numberOfEmployees: "Small",
          currentMarketing: ["LinkedIn", "Email", "Referral"],
          onlinePresence: "Active",
          websiteUrl: "https://pixelstack.uk",
          socialMediaLink: "https://linkedin.com/company/pixelstack",
          acceptsCardPayments: "Yes",
          acceptsCash: "No",
          monthlyTransactions: "Medium",
          averageOrderValue: "High",
          status: "approved"
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found with ID: ' + PIXELSTACK_ID });
    }

    // 2. Clear existing payments
    await Payment.deleteMany({ userId: PIXELSTACK_ID });

    // 3. Create Payment History
    const payments = [
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Digital Ventures Ltd",
        senderEmail: "finance@digitalventures.com",
        amount: 1250,
        currency: "gbp",
        description: "Software Subscription - Annual",
        paymentPurpose: "Subscription",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "John Smith",
        senderEmail: "jsmith@freelance.co.uk",
        amount: 850,
        currency: "gbp",
        description: "UI/UX Design Consultation",
        paymentPurpose: "Service Fee",
        paymentMode: "CreditCard",
        status: "success",
        paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Global Retail Corp",
        senderEmail: "billing@globalretail.com",
        amount: 2100,
        currency: "gbp",
        description: "Custom API Integration",
        paymentPurpose: "Project Payment",
        paymentMode: "NetBanking",
        status: "success",
        paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Sarah Connor",
        senderEmail: "sarah@skynet.net",
        amount: 450,
        currency: "gbp",
        description: "Monthly Maintenance",
        paymentPurpose: "Maintenance",
        paymentMode: "Wallet",
        status: "success",
        paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Tech Innovators",
        senderEmail: "payments@techinn.com",
        amount: 1500,
        currency: "gbp",
        description: "Cloud Hosting Setup",
        paymentPurpose: "Infrastructure",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Domain Registrar Inc",
        senderEmail: "billing@domainreg.com",
        amount: 95,
        currency: "gbp",
        description: "Domain Renewal",
        paymentPurpose: "Subscription",
        paymentMode: "DebitCard",
        status: "success",
        paidAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "StartUp Hub",
        senderEmail: "hello@startuphub.com",
        amount: 3000,
        currency: "gbp",
        description: "Mobile App MVP - Milestone 1",
        paymentPurpose: "Project Payment",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        userId: PIXELSTACK_ID,
        businessId: PIXELSTACK_ID,
        senderName: "Marketing Solutions",
        senderEmail: "finance@marketingsol.com",
        amount: 500,
        currency: "gbp",
        description: "Strategy Consultation",
        paymentPurpose: "Consultation",
        paymentMode: "Stripe",
        status: "success",
        paidAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
      }
    ];

    await Payment.insertMany(payments);

    res.json({ success: true, message: 'PixelStack seeded successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Owner self-update route (must come before :id routes) ─────────────────────
router.put("/me", protect, authorize("owner"), updateOwnProfile);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.route("/").get(protect, authorize("admin"), getUsers).post(protect, authorize("admin"), createUser);

// GET by ID — admin sees any user; owner sees their own (handled in controller)
router.get("/:id", protect, authorize("admin", "owner"), getUserById);

// PUT — admin can update operational fields; owner can update all fields including identity
router.put("/:id", protect, authorize("admin", "owner"), updateUser);

// Admin-only mutations
router.delete("/:id", protect, authorize("admin"), deleteUser);
router.patch("/:id/status", protect, authorize("admin"), updateUserStatus);

module.exports = router;
