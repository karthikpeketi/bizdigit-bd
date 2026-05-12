const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("./asyncHandler");
const { ApiError } = require("./errorHandler");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Not authorized. Missing Bearer token");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev_only_change_this_secret"
    );

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      throw new ApiError(401, "Not authorized. User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, "Not authorized. Invalid or expired token");
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Not authorized. Missing user context");
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied for this role");
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};
