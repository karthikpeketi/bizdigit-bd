const dotenv = require("dotenv");
dotenv.config({ override: true });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

connectDB();

const app = express();

// Enable CORS + JSON body parsing for all API routes.
app.use(cors());
app.use(express.json());

// Quick health endpoint to confirm server status.
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "API is running" });
});

// Main feature routes.
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/chat", chatRoutes);

// Fallback + centralized error middleware.
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
