const express = require("express");
const {
  registerUser,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  changePassword,
  checkEmail,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getCurrentUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", protect, changePassword);
router.post("/check-email", checkEmail);

module.exports = router;
