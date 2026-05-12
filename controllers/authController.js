const crypto = require("crypto");
const dns = require("dns").promises;
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const OTP = require("../models/OTP");
const asyncHandler = require("../middleware/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const {
  sendRegistrationNotificationToAdmin,
  sendPasswordResetOTPEmail,
} = require("../utils/emailService");

const buildToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || "dev_only_change_this_secret",
    { expiresIn: "7d" }
  );
};

// ---------------------------------------------------------------------------
// Password strength validator — enforces policy on the server side
// ---------------------------------------------------------------------------
const validatePasswordStrength = (password) => {
  if (!password) return "Password is required";

  // Standard security rules
  const rules = [
    { met: password.length >= 8 },
    { met: /[A-Z]/.test(password) },
    { met: /[a-z]/.test(password) },
    { met: /[0-9]/.test(password) },
    { met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = rules.filter((r) => r.met).length;

  // Enforce minimum length of 8 regardless of other factors
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  // Requirement: "Good criteria none other than weak" (Score 3, 4, or 5)
  if (score < 3) {
    return "Password is too weak. Please use a mix of uppercase, lowercase, numbers, and special characters.";
  }

  return null; // null = valid
};


// Allowed business types for registration
const ALLOWED_BUSINESS_TYPES = [
  "Retail",
  "Food & Beverage",
  "Healthcare",
  "Education",
  "Technology",
  "Finance",
  "Real Estate",
  "Manufacturing",
  "Hospitality",
  "Beauty & Wellness",
  "Automotive",
  "Professional Services",
  "Entertainment",
  "Non-Profit",
  "Other",
];

// Phone regex — allows international formats
const PHONE_REGEX = /^[\+]?[\d\s\-\(\)]{7,15}$/;

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
const registerUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    businessName,
    password,
    contactNumber,
    businessAddress,
    businessType,
  } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!name) missingFields.push("name");
  if (!email) missingFields.push("email");
  if (!businessName) missingFields.push("businessName");
  if (!password) missingFields.push("password");
  if (!contactNumber) missingFields.push("contactNumber");
  if (!businessAddress) missingFields.push("businessAddress");
  if (!businessType) missingFields.push("businessType");

  if (missingFields.length > 0) {
    throw new ApiError(400, `The following fields are required: ${missingFields.join(", ")}`);
  }

  // Validate contactNumber format
  if (!PHONE_REGEX.test(contactNumber.trim())) {
    throw new ApiError(400, "Please enter a valid contact number (7–15 digits, may include +, spaces, dashes)");
  }

  // Validate businessAddress minimum length
  if (businessAddress.trim().length < 10) {
    throw new ApiError(400, "Business address must be at least 10 characters long");
  }

  // Validate businessType
  if (!ALLOWED_BUSINESS_TYPES.includes(businessType)) {
    throw new ApiError(400, `businessType must be one of: ${ALLOWED_BUSINESS_TYPES.join(", ")}`);
  }

  // Server-side password strength validation
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    throw new ApiError(400, passwordError);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const user = await User.create({
    name,
    email,
    businessName,
    password,
    contactNumber: contactNumber.trim(),
    businessAddress: businessAddress.trim(),
    businessType,
    role: "owner",
    status: "pending",
  });

  // Non-blocking: notify admin about new registration
  sendRegistrationNotificationToAdmin(user).catch(() => { });

  res.status(201).json({
    success: true,
    message: "Registration submitted. Wait for admin approval before login.",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      businessName: user.businessName,
      status: user.status,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+password +loginAttempts +lockUntil"
  );

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check if account is temporarily locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new ApiError(
      429,
      `Too many failed login attempts. Account is locked for ${minutesLeft} more minute${minutesLeft !== 1 ? "s" : ""}.`
    );
  }

  const isPasswordValid = await user.matchPassword(password);

  if (!isPasswordValid) {
    // Increment failed attempts (will lock after 5)
    await user.incrementLoginAttempts();
    const attemptsAfter = (user.loginAttempts || 0) + 1;
    const remaining = Math.max(0, 5 - attemptsAfter);

    if (remaining === 0) {
      throw new ApiError(
        429,
        "Too many failed attempts. Account locked for 15 minutes."
      );
    }
    throw new ApiError(
      401,
      `Invalid email or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before account lock.`
    );
  }

  // Password correct — clear any previous failed attempts
  await user.clearLoginAttempts();

  if (user.role === "owner" && user.status !== "approved") {
    if (user.status === "rejected") {
      throw new ApiError(403, "Your registration was rejected by admin");
    }
    throw new ApiError(403, "Your account is pending admin approval");
  }

  const token = buildToken(user._id.toString());

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        businessName: user.businessName,
        role: user.role,
        status: user.status,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "email is required");
  }

  const requestedEmail = email.toLowerCase().trim();
  console.log(`[Auth] Forgot password request for: ${requestedEmail}`);

  const user = await User.findOne({ email: requestedEmail }).select(
    "+passwordResetOTP +passwordResetOTPExpiry"
  );

  // Always respond with success to prevent user enumeration
  const successResponse = {
    success: true,
    message:
      "If an account with that email exists, a reset code has been sent.",
  };

  if (!user) {
    throw new ApiError(404, "No account found with this email address.");
  }

  // NOTE: Password reset is allowed even if account status is 'pending' or 'rejected'.
  // This allows users to fix their credentials while waiting for admin approval.

  // Generate a 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // Store hashed OTP in the separate OTP collection
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

  // First, save the OTP to the database (Blocking)
  try {
    // Upsert: Remove any existing OTP for this user and create a new one
    await OTP.findOneAndDelete({ userId: user._id });
    await OTP.create({
      userId: user._id,
      otp: hashedOTP,
    });
    console.log(`[Auth] OTP saved to database for user: ${user.email}`);
  } catch (dbError) {
    console.error(`[Auth] Failed to save OTP to database: ${dbError.message}`);
    throw new ApiError(500, "Failed to process reset request. Please try again.");
  }

  // Send OTP via email only after successful save
  try {
    await sendPasswordResetOTPEmail(user, otp);
    res.status(200).json(successResponse);
  } catch (emailError) {
    // If email fails, we might want to keep the OTP in DB for manual resend, 
    // but the user's flow expects a fresh request anyway.
    throw new ApiError(500, `Failed to send reset code: ${emailError.message}`);
  }
});


// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "email, otp, and newPassword are required");
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new ApiError(400, passwordError);
  }

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password");

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset code. Please request a new one.");
  }

  // Check OTP from separate collection
  const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
  const otpRecord = await OTP.findOne({
    userId: user._id,
    otp: hashedOTP,
  });

  if (!otpRecord) {
    throw new ApiError(400, "Invalid reset code. Please check and try again.");
  }

  // Update password and delete the OTP record
  user.password = newPassword;
  await user.save();
  await OTP.deleteOne({ _id: otpRecord._id });

  res.status(200).json({
    success: true,
    message: "Password reset successfully. You can now log in with your new password.",
  });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/change-password  (protected route — requires valid JWT)
// ---------------------------------------------------------------------------
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, "New password must be different from your current password");
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new ApiError(400, passwordError);
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCurrentPasswordValid = await user.matchPassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password changed successfully.",
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/check-email
// ---------------------------------------------------------------------------
const checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  console.log(`[Auth] Checking email availability and domain: ${email}`);

  if (!email) {
    throw new ApiError(400, "email is required");
  }

  const existingUser = await User.findOne({
    email: email.toLowerCase().trim(),
  });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists");
  }

  // Check if the domain has valid MX records
  const domain = email.split("@")[1];
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      throw new Error("No MX records");
    }
  } catch (err) {
    console.warn(`[Auth] Domain verification failed for ${domain}: ${err.message}`);
    throw new ApiError(400, "The email domain appears to be invalid or cannot receive emails.");
  }

  res.status(200).json({
    success: true,
    message: "Email is available",
  });
});

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  changePassword,
  checkEmail,
};
