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
