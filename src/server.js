const app = require("./app");


// server.js only starts HTTP; all app behavior lives in app.js and routes.
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`CodeLens is running on port ${PORT}`);
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
