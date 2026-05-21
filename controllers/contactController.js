const asyncHandler = require("../middleware/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");
const { sendContactFormSubmissionEmail } = require("../utils/emailService");

const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, company, message } = req.body;
  const missingFields = [];

  if (!name || !name.trim()) missingFields.push("name");
  if (!email || !email.trim()) missingFields.push("email");
  if (!message || !message.trim()) missingFields.push("message");

  if (missingFields.length > 0) {
    throw new ApiError(
      400,
      `Please provide the following required field${missingFields.length > 1 ? "s" : ""}: ${missingFields.join(", ")}`
    );
  }

  const emailValue = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailValue)) {
    throw new ApiError(400, "Please enter a valid email address.");
  }

  await sendContactFormSubmissionEmail({
    name: name.trim(),
    email: emailValue,
    company: company?.trim() || "Not provided",
    message: message.trim(),
  });

  res.status(200).json({
    success: true,
    message: "Your message has been sent. Our team will reply shortly.",
  });
});

module.exports = {
  submitContactForm,
};
