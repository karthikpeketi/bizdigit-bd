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
app.set("trust proxy", 1);

// Enable CORS + JSON body parsing for all API routes.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "https://bizdigit.vercel.app"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        // In production, you might want to be stricter, but for now we'll allow all if FRONTEND_URL is *
        if (process.env.FRONTEND_URL === "*") {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);

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

// Export the app for Vercel serverless functions
module.exports = app;

// Only start the server if this file is run directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

