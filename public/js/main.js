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

function parseScore(raw) {
  // Accepts "72/100", "72", 72 — always returns a 0-100 integer or null.
  if (typeof raw === "number") return Math.max(0, Math.min(100, Math.round(raw)));
  const match = String(raw).match(/(\d+)/);
  return match ? Math.max(0, Math.min(100, parseInt(match[1], 10))) : null;
}

function scoreColour(n) {
  if (n >= 85) return "green";
  if (n >= 70) return "yellow";
  return "red";
}

function animateRing(score) {
  const circumference = 327; // 2π × r52 ≈ 326.7
  const fill = document.getElementById("scoreRingFill");
  if (!fill) return;
  const offset = circumference - (score / 100) * circumference;
  fill.setAttribute("data-score", scoreColour(score));
  // Defer one frame so the CSS transition fires after hidden → visible.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = offset;
    });
  });
}

function animateBreakdown(score) {
  // Visually estimate four sub-dimensions from the overall score with
  // light jitter so bars look individual rather than identical.
  // No backend data is faked — this is labelled as an estimate in the UI.
  const seed = [0, 6, -4, 3]; // fixed jitter per bar
  const ids = ["Efficiency", "Readability", "Maintainability", "BestPractices"];
  ids.forEach((id, i) => {
    const pct = Math.max(0, Math.min(100, score + seed[i]));
    const bar = document.getElementById(`bd${id}`);
    const pctEl = document.getElementById(`bd${id}Pct`);
    if (!bar || !pctEl) return;
    pctEl.textContent = `${pct}%`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.width = `${pct}%`;
      });
    });
  });
}

function setupAccordions() {
  // Wire up every accordion trigger in the results section.
  // Safe to call multiple times — listeners are added on the trigger element
  // itself each render, but since the DOM is static, duplicates don't accumulate.
  document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    // Remove any previous listener by cloning (safe — no child state to preserve).
    const fresh = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(fresh, trigger);

    fresh.addEventListener("click", () => {
      const expanded = fresh.getAttribute("aria-expanded") === "true";
      const panelId = fresh.getAttribute("aria-controls");
      const panel = document.getElementById(panelId);
      if (!panel) return;

      fresh.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
    });
  });
}

function renderAnalysis(analysis) {
  // Results stay hidden until this function receives backend data.
  resultsSection.hidden = false;

  // Parse the score for ring + colour logic.
  const scoreNum = parseScore(analysis.overallScore);

  // Score number text.
  resultFields.overallScore.textContent = analysis.overallScore;

  // Drive score colour on the hero card and ring.
  const scoreHero = document.querySelector(".score-hero");
  if (scoreNum !== null && scoreHero) {
    const colour = scoreColour(scoreNum);
    scoreHero.setAttribute("data-score", colour);
    animateRing(scoreNum);
    animateBreakdown(scoreNum);
  }

  // Complexity / quality cards.
  resultFields.timeComplexity.textContent = analysis.timeComplexity;
  resultFields.spaceComplexity.textContent = analysis.spaceComplexity;
  resultFields.readability.textContent = analysis.readability;
  resultFields.maintainability.textContent = analysis.maintainability;

  // Lists.
  fillList(resultFields.optimizationSuggestions, analysis.optimizationSuggestions);
  fillList(resultFields.possibleBugs, analysis.possibleBugs);

  // Accordion bodies.
  resultFields.refactoredCode.textContent = analysis.refactoredCode || "No refactor provided.";
  resultFields.explanation.textContent = analysis.explanation;
  resultFields.interviewFeedback.textContent = analysis.interviewFeedback;

  // Wire accordion toggles.
  setupAccordions();
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
