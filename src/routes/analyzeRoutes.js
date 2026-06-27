const express = require("express");

const { analyzeCode } = require("../controllers/analyzeController");

const router = express.Router();

// The whole API is one route because CodeLens has one job: analyze pasted code.
router.post("/", analyzeCode);

module.exports = router;
