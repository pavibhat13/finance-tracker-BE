import { ENV } from "../config/env.js";

export const errorHandler = (err, req, res, next) => {
  console.error("Server Error:", err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: ENV.NODE_ENV === "production" ? null : err.stack
  });
};
