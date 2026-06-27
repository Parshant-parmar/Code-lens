const path = require("path");
require("dotenv").config({ quiet: true });

const express = require("express");

const analyzeRoutes = require("./routes/analyzeRoutes");

const app = express();

// Accept larger snippets without needing uploads or a database.
app.use(express.json({ limit: "1mb" }));

// Serve the one-page developer tool from /public.
app.use(express.static(path.join(__dirname, "..", "public")));

// Keep the backend surface area intentionally tiny.
app.use("/analyze", analyzeRoutes);

app.use("/analyze", (request, response) => {
  response.status(404).json({ error: "Analyze endpoint not found." });
});

app.use((error, request, response, next) => {
  if (!request.path.startsWith("/analyze")) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ error: "Request body must be valid JSON." });
  }

  if (error.type === "entity.too.large") {
    return response.status(413).json({ error: "Code input is too large." });
  }

  console.error(`Request error: ${error.message}`);
  return response.status(500).json({ error: "Something went wrong while processing the request." });
});

module.exports = app;
