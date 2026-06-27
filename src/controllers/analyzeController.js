const { getCodeAnalysis } = require("../services/aiService");

const SUPPORTED_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
]);

function isValidCode(code) {
  // Keep validation readable: the API only needs a non-empty code string.
  return typeof code === "string" && code.trim().length > 0;
}

function isValidLanguage(language) {
  return typeof language === "string" && SUPPORTED_LANGUAGES.has(language);
}

async function analyzeCode(request, response) {
  const { code, language } = request.body;

  if (!isValidCode(code)) {
    return response.status(400).json({ error: "Code is required." });
  }

  if (!isValidLanguage(language)) {
    return response.status(400).json({ error: "Choose a supported language." });
  }

  try {
    const analysis = await getCodeAnalysis({
      code: code.trim(),
      language,
    });

    return response.json({ analysis });
  } catch (error) {
    // Log the useful message without filling the terminal with a stack trace.
    console.error(`Analysis error: ${error.message}`);
    return response.status(error.statusCode || 500).json({
      error: error.message || "Code analysis failed.",
    });
  }
}

module.exports = {
  analyzeCode,
};
