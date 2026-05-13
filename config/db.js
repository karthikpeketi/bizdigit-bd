const mongoose = require("mongoose");

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // In serverless, we shouldn't necessarily exit the process, 
    // but throwing the error will let the function retry or fail gracefully.
    throw error;
  }
};

module.exports = connectDB;

