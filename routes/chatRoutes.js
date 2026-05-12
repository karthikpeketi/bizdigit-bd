const express = require("express");
const { chatWithAssistant } = require("../controllers/chatController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, authorize("owner"), chatWithAssistant);

module.exports = router;
