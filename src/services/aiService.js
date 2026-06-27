const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.0-flash";
const REQUEST_TIMEOUT_MS = 20000;

const REQUIRED_KEYS = [
  "overallScore",
  "timeComplexity",
  "spaceComplexity",
  "readability",
  "maintainability",
  "optimizationSuggestions",
  "possibleBugs",
  "refactoredCode",
  "explanation",
  "interviewFeedback",
];

class AnalysisError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AnalysisError";
    this.statusCode = statusCode;
  }
}

function getApiKey() {
  // The API key stays on the server so the browser never exposes it.
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new AnalysisError("Gemini API key is missing. Add GEMINI_API_KEY to your .env file.", 500);
  }

  return apiKey;
}

function buildPrompt({ code, language }) {
  // A strict prompt makes the backend response predictable for the UI.
  return `
Analyze this ${language} code for a developer tool named CodeLens.

Return only valid JSON with exactly these keys:
{
  "overallScore": "score from 0 to 100 as a string, include /100",
  "timeComplexity": "Big-O estimate",
  "spaceComplexity": "Big-O estimate",
  "readability": "short rating with one useful note",
  "maintainability": "short rating with one useful note",
  "optimizationSuggestions": ["specific suggestion"],
  "possibleBugs": ["specific possible bug or edge case"],
  "refactoredCode": "improved code as a string",
  "explanation": "plain-English explanation",
  "interviewFeedback": "concise interview-style feedback"
}

Do not include markdown fences.
Do not include text outside the JSON object.

Code:
${code}
`;
}

function buildGeminiRequest(prompt) {
  // responseMimeType asks Gemini for JSON while the controller still validates it.
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };
}

function extractTextFromGemini(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new AnalysisError("Gemini returned an empty response. Please try again.", 502);
  }

  return text;
}

function parseJson(text) {
  // Trim markdown fences just in case the model ignores the JSON-only instruction.
  const cleanedText = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    throw new AnalysisError("Gemini returned invalid JSON. Please try again.", 502);
  }
}

function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeScore(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(0, Math.min(100, Math.round(value)))}/100`;
  }

  return normalizeString(value, "N/A");
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());
}

function validateAnalysis(analysis) {
  // Validate every field so the frontend can render without defensive clutter.
  const missingKey = REQUIRED_KEYS.find((key) => !(key in analysis));

  if (missingKey) {
    throw new AnalysisError(`Gemini response is missing ${missingKey}. Please try again.`, 502);
  }

  return {
    overallScore: normalizeScore(analysis.overallScore),
    timeComplexity: normalizeString(analysis.timeComplexity, "Unknown"),
    spaceComplexity: normalizeString(analysis.spaceComplexity, "Unknown"),
    readability: normalizeString(analysis.readability, "Unknown"),
    maintainability: normalizeString(analysis.maintainability, "Unknown"),
    optimizationSuggestions: normalizeList(analysis.optimizationSuggestions),
    possibleBugs: normalizeList(analysis.possibleBugs),
    refactoredCode: normalizeString(analysis.refactoredCode, ""),
    explanation: normalizeString(analysis.explanation, "No explanation provided."),
    interviewFeedback: normalizeString(analysis.interviewFeedback, "No feedback provided."),
  };
}

function getRequestUrl() {
  const apiKey = encodeURIComponent(getApiKey());
  const model = encodeURIComponent((process.env.GEMINI_MODEL || DEFAULT_MODEL).trim());

  return `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AnalysisError("Gemini request timed out. Please try again.", 504);
    }

    throw new AnalysisError("Unable to reach Gemini. Check your network connection and try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function readGeminiPayload(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AnalysisError("Gemini returned an unreadable response. Please try again.", 502);
  }
}

function buildGeminiError(payload, status) {
  const rawMessage = payload?.error?.message || "";
  const lowerMessage = rawMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return new AnalysisError("Gemini rejected the API key. Check GEMINI_API_KEY in your .env file.", 500);
  }

  if (status === 429 || lowerMessage.includes("quota") || lowerMessage.includes("rate limit")) {
    return new AnalysisError("Gemini quota is exhausted or rate limited. Please try again later.", 429);
  }

  if (status === 400) {
    return new AnalysisError("Gemini rejected the request. Check GEMINI_MODEL and try again.", 502);
  }

  return new AnalysisError("Gemini request failed. Please try again.", status >= 500 ? 502 : 400);
}

async function callGemini(prompt) {
  const response = await fetchWithTimeout(getRequestUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiRequest(prompt)),
  });

  const payload = await readGeminiPayload(response);

  if (!response.ok) {
    throw buildGeminiError(payload, response.status);
  }

  return payload;
}

async function getCodeAnalysis({ code, language }) {
  const prompt = buildPrompt({ code, language });
  const payload = await callGemini(prompt);
  const text = extractTextFromGemini(payload);
  const analysis = parseJson(text);

  return validateAnalysis(analysis);
}

module.exports = {
  getCodeAnalysis,
};
