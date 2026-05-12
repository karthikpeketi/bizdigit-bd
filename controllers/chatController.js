const asyncHandler = require("../middleware/asyncHandler");
const { ApiError } = require("../middleware/errorHandler");

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
];

const buildGeminiContents = (history, message) => {
  const safeHistory = Array.isArray(history) ? history : [];

  const historyContents = safeHistory
    .filter(
      (entry) =>
        (entry.role === "assistant" || entry.role === "user") &&
        typeof entry.content === "string" &&
        entry.content.trim().length > 0
    )
    .map((entry) => ({
      role: entry.role === "assistant" ? "model" : "user",
      parts: [{ text: entry.content.trim() }],
    }));

  return [...historyContents, { role: "user", parts: [{ text: message }] }];
};

const buildModelCandidates = () => {
  const configuredModel = (process.env.GEMINI_MODEL || "").trim();
  const candidates = [configuredModel, ...DEFAULT_FALLBACK_MODELS].filter(Boolean);
  return [...new Set(candidates)];
};

const isModelUnavailableError = (status, errorMessage = "") => {
  if (status === 404) return true;

  const normalized = String(errorMessage).toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("not supported for generatecontent")
  );
};

const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, "message is required");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured on the backend");
  }

  const modelCandidates = buildModelCandidates();
  const contents = buildGeminiContents(history, message.trim());
  const payload = {
    system_instruction: {
      parts: [
        {
          text:
            "You are a 24/7 AI customer support assistant. Answer only about website services, digital marketing, payment gateways, and business support. Keep answers short, practical, and helpful.",
        },
      ],
    },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 220,
    },
  };

  let geminiData = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const model = modelCandidates[index];
    const endpoint = `${GEMINI_API_BASE}/${model}:generateContent`;

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await geminiResponse.json();

    if (geminiResponse.ok) {
      geminiData = responseData;
      break;
    }

    const errorMessage = responseData?.error?.message || "Gemini API request failed";
    const canRetryWithNextModel =
      index < modelCandidates.length - 1 &&
      isModelUnavailableError(geminiResponse.status, errorMessage);

    if (!canRetryWithNextModel) {
      throw new ApiError(geminiResponse.status, errorMessage);
    }
  }

  if (!geminiData) {
    throw new ApiError(500, "No supported Gemini model is configured");
  }

  const reply = geminiData?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join(" ")
    .trim();

  res.status(200).json({
    success: true,
    data: {
      reply: reply || "I could not generate a response right now. Please try again.",
    },
  });
});

module.exports = {
  chatWithAssistant,
};
