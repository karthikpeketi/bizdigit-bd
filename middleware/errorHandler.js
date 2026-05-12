class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((value) => value.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    if (field === "email") {
      message = "A user with this email already exists";
    } else {
      message = `Duplicate record detected for ${field}. Multiple entries for this value are not allowed.`;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = {
  ApiError,
  notFound,
  errorHandler,
};
