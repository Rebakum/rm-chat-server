import { Request, Response, NextFunction } from "express";
import multer from "multer";
import logger from "../lib/logger";
import ApiError from "../utils/ApiError";

const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  const isApiError = err instanceof ApiError;
  const isMulterError = err instanceof multer.MulterError;
  const statusCode = isApiError
    ? err.statusCode
    : isMulterError
      ? err.code === "LIMIT_FILE_SIZE"
        ? 413
        : 400
    : err?.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;
  const message = isApiError
    ? err.message
    : isMulterError
      ? err.code === "LIMIT_FILE_SIZE"
        ? "File exceeds the 10MB limit"
        : err.message
    : statusCode >= 400 && statusCode < 500
      ? "Bad request"
      : "Internal Server Error";

  logger.error(err?.message || "Unhandled server error", {
    statusCode,
    path: req.path,
    method: req.method,
    stack: err?.stack,
  });

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;
