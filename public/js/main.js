const languageSelect = document.querySelector("#languageSelect");
const themeToggle = document.querySelector("#themeToggle");
const analyzeButton = document.querySelector("#analyzeButton");
const clearButton = document.querySelector("#clearButton");
const copyButton = document.querySelector("#copyButton");
const statusMessage = document.querySelector("#statusMessage");
const resultsSection = document.querySelector("#resultsSection");

const resultFields = {
  overallScore: document.querySelector("#overallScore"),
  timeComplexity: document.querySelector("#timeComplexity"),
  spaceComplexity: document.querySelector("#spaceComplexity"),
  readability: document.querySelector("#readability"),
  maintainability: document.querySelector("#maintainability"),
  optimizationSuggestions: document.querySelector("#optimizationSuggestions"),
  possibleBugs: document.querySelector("#possibleBugs"),
  refactoredCode: document.querySelector("#refactoredCode"),
  explanation: document.querySelector("#explanation"),
  interviewFeedback: document.querySelector("#interviewFeedback"),
};

const monacoLanguages = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  java: "java",
  cpp: "cpp",
  csharp: "csharp",
  go: "go",
  rust: "rust",
  php: "php",
  ruby: "ruby",
};

let editor;

// Monaco owns the editing experience while the rest of the app stays vanilla JS.
if (!window.require?.config) {
  setStatus("Code editor failed to load. Check your connection and refresh.", true);
  analyzeButton.disabled = true;
} else {
  window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });
  window.require(["vs/editor/editor.main"], () => {
    editor = monaco.editor.create(document.querySelector("#editor"), {
      value: "",
      language: monacoLanguages[languageSelect.value],
      theme: "vs",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineHeight: 22,
      padding: { top: 16, bottom: 16 },
      scrollBeyondLastLine: false,
      wordWrap: "on",
    });

    editor.focus();
  }, () => {
    setStatus("Code editor failed to load. Check your connection and refresh.", true);
    analyzeButton.disabled = true;
  });
}

function getCode() {
  // Reading through one helper keeps button handlers small and easy to follow.
  return editor ? editor.getValue().trim() : "";
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.textContent = isLoading ? "Analyzing..." : "Analyze";
}

function fillList(listElement, items) {
  // Rebuild each list from trusted text nodes to avoid injecting HTML.
  listElement.innerHTML = "";

  const safeItems = Array.isArray(items) && items.length ? items : ["No issues found."];

  safeItems.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    listElement.appendChild(listItem);
  });
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return {
      error: response.ok
        ? "The server returned an invalid response."
        : "The server returned an unreadable error response.",
    };
  }
}

function renderAnalysis(analysis) {
  // Results stay hidden until this function receives backend data.
  resultsSection.hidden = false;

  resultFields.overallScore.textContent = analysis.overallScore;
  resultFields.timeComplexity.textContent = analysis.timeComplexity;
  resultFields.spaceComplexity.textContent = analysis.spaceComplexity;
  resultFields.readability.textContent = analysis.readability;
  resultFields.maintainability.textContent = analysis.maintainability;

  fillList(resultFields.optimizationSuggestions, analysis.optimizationSuggestions);
  fillList(resultFields.possibleBugs, analysis.possibleBugs);

  resultFields.refactoredCode.textContent = analysis.refactoredCode || "No refactor provided.";
  resultFields.explanation.textContent = analysis.explanation;
  resultFields.interviewFeedback.textContent = analysis.interviewFeedback;
}

async function analyzeCode() {
  const code = getCode();

  if (!code) {
    setStatus("Paste code before analyzing.", true);
    editor?.focus();
    return;
  }

  setLoading(true);
  setStatus("Sending code to Gemini...");

  try {
    const response = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        language: languageSelect.value,
      }),
    });

    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(payload.error || "Analysis failed.");
    }

    renderAnalysis(payload.analysis);
    setStatus("Analysis complete.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

function clearWorkspace() {
  editor?.setValue("");
  resultsSection.hidden = true;
  setStatus("");
  copyButton.textContent = "Copy";
  editor?.focus();
}

async function copyCode() {
  const code = getCode();

  if (!code) {
    setStatus("Paste code before copying.", true);
    editor?.focus();
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    copyButton.textContent = "Copied";
    setStatus("Code copied.");
  } catch (error) {
    setStatus("Unable to copy code. Please copy it manually.", true);
    return;
  }

  setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1200);
}

function toggleTheme() {
  document.body.classList.toggle("dark-theme");

  const isDark = document.body.classList.contains("dark-theme");
  themeToggle.textContent = isDark ? "Light" : "Dark";
  window.monaco?.editor.setTheme(isDark ? "vs-dark" : "vs");
}

languageSelect.addEventListener("change", () => {
  if (!editor) {
    return;
  }

  const model = editor.getModel();
  window.monaco.editor.setModelLanguage(model, monacoLanguages[languageSelect.value]);
  editor.focus();
});

analyzeButton.addEventListener("click", analyzeCode);
clearButton.addEventListener("click", clearWorkspace);
copyButton.addEventListener("click", copyCode);
themeToggle.addEventListener("click", toggleTheme);
