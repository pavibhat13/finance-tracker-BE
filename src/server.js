import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { ensureAdminSync } from "./controllers/authController.js";
import app from "./app.js";

const startServer = async () => {
  try {
    await connectDB();
    await ensureAdminSync();
    const server = app.listen(ENV.PORT, () => {
      console.log(`Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`);
    });

    const shutdown = () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
