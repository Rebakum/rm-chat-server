import http from "http";
import app from "./app";
import { initSocket } from "./sockets";
import prisma from "./lib/prisma";
import logger from "./lib/logger";
import ensureAdmin from "./lib/ensureAdmin";

const PORT = process.env.PORT || 5000;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withRetry = async <T>(
  fn: () => Promise<T>,
  tries = 6,
  delayMs = 2000,
): Promise<T> => {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === tries) throw error;
      const waitTime = delayMs * attempt; // 2s, 4s, 6s, 8s, 10s...
      logger.warn(
        `Retrying operation (attempt ${attempt + 1}/${tries}) in ${waitTime}ms...`,
      );
      await wait(waitTime);
    }
  }

  throw new Error("Retry operation did not complete");
};

const start = async (): Promise<void> => {
  try {
    await withRetry(ensureAdmin, 6, 2000);
  } catch (error) {
    logger.error(
      "Admin initialization failed after database retries. Shutting down.",
      error,
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Prisma disconnected.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

start();

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});