const app = require("./app");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

// server.js only starts HTTP; all app behavior lives in app.js and routes.
const server = app.listen(PORT, HOST, () => {
  console.log(`CodeLens is running at http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  // Friendly startup errors help beginners fix common local issues quickly.
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error("Set PORT to another value and start the app again.");
    process.exit(1);
  }

  if (error.code === "EPERM") {
    console.error(`Permission denied while starting http://${HOST}:${PORT}.`);
    console.error("Try a different port, or start the app from a normal terminal.");
    process.exit(1);
  }

  throw error;
});
