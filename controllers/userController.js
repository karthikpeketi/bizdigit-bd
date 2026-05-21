const User = require("../models/User");
const asyncHandler = require("../middleware/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const {
  sendApprovalEmail,
  sendRejectionEmail,
} = require("../utils/emailService");

// Fields that ONLY the business owner can modify — admins are blocked from changing these.
const OWNER_ONLY_FIELDS = [
  "name",
  "email",
  "businessName",
  "contactNumber",
  "businessEmail",
  "businessType",
  "businessAddress",
];

const getUsers = asyncHandler(async (req, res) => {
  const { search = "", status = "", sortField = "createdAt", sortOrder = "desc" } = req.query;

  // Build the MongoDB filter object
  const filter = {};

  // Search with case-insensitive regex across name, email, businessName
  if (search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [{ name: regex }, { email: regex }, { businessName: regex }];
  }

  // Status filter — skip if empty or "all"
  if (status && status !== "all") {
    filter.status = status;
  }

  // Sorting — whitelist allowed fields to prevent injection
  const allowedSortFields = ["name", "email", "businessName", "createdAt", "status"];
  const field = allowedSortFields.includes(sortField) ? sortField : "createdAt";
  const order = sortOrder === "asc" ? 1 : -1;

  const users = await User.find(filter).sort({ [field]: order });

  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, businessName, password, role = "owner" } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "name, email, and password are required");
  }

  if (role !== "admin" && !businessName) {
    throw new ApiError(400, "businessName is required for non-admin accounts");
  }

  const user = await User.create({ name, email, businessName, password, role });

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const requestingRole = req.user?.role;

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // ── RBAC: Admins cannot change owner-identity fields ──────────────────
  if (requestingRole === "admin") {
    const attemptedRestrictedFields = OWNER_ONLY_FIELDS.filter((field) => {
      if (req.body[field] === undefined) return false;
      const newVal = String(req.body[field]).trim();
      const oldVal = String(user[field] ?? "").trim();
      if (field === "email" || field === "businessEmail") {
        return newVal.toLowerCase() !== oldVal.toLowerCase();
      }
      return newVal !== oldVal;
    });

    if (attemptedRestrictedFields.length > 0) {
      throw new ApiError(
        403,
        `Admins are not permitted to modify the following owner-only fields: ${attemptedRestrictedFields.join(", ")}`
      );
    }
  }

  // Build the update payload — admins can only update operational/digital/payment fields
  const allowedForAdmin = [
    "dailyFootfall",
    "peakHours",
    "workingDays",
    "targetAudience",
    "numberOfEmployees",
    "currentMarketing",
    "onlinePresence",
    "websiteUrl",
    "socialMediaLink",
    "acceptsCardPayments",
    "acceptsCash",
    "monthlyTransactions",
    "averageOrderValue",
    "status",
  ];

  const allowedForOwner = [...OWNER_ONLY_FIELDS, ...allowedForAdmin];

  const allowedFields = requestingRole === "admin" ? allowedForAdmin : allowedForOwner;

  const updatePayload = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updatePayload[field] = req.body[field];
    }
  });

  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    updatePayload,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
});

// Owner self-update — updates only the authenticated owner's own profile
const updateOwnProfile = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;

  // Owners can update all fields except role and status
  const {
    name,
    email,
    businessName,
    contactNumber,
    businessEmail,
    businessType,
    businessAddress,
    dailyFootfall,
    peakHours,
    workingDays,
    targetAudience,
    numberOfEmployees,
    currentMarketing,
    onlinePresence,
    websiteUrl,
    socialMediaLink,
    acceptsCardPayments,
    acceptsCash,
    monthlyTransactions,
    averageOrderValue,
  } = req.body;

  const updatePayload = {
    name,
    email,
    businessName,
    contactNumber,
    businessEmail,
    businessType,
    businessAddress,
    dailyFootfall,
    peakHours,
    workingDays,
    targetAudience,
    numberOfEmployees,
    currentMarketing,
    onlinePresence,
    websiteUrl,
    socialMediaLink,
    acceptsCardPayments,
    acceptsCash,
    monthlyTransactions,
    averageOrderValue,
  };

  // Strip undefined values
  Object.keys(updatePayload).forEach(
    (key) => updatePayload[key] === undefined && delete updatePayload[key]
  );

  const user = await User.findByIdAndUpdate(ownerId, updatePayload, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["approved", "rejected", "pending"].includes(status)) {
    throw new ApiError(400, "status must be one of: approved, rejected, pending");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Non-blocking: send approval or rejection email to the customer
  if (status === "approved") {
    sendApprovalEmail(user).catch(() => {});
  } else if (status === "rejected") {
    sendRejectionEmail(user).catch(() => {});
  }

  res.status(200).json({
    success: true,
    message: `User status updated to ${status}`,
    data: user,
  });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateOwnProfile,
  deleteUser,
  updateUserStatus,
};
