import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import { toNodeHandler } from "better-auth/node";
import env from "./config/env";
import auth from "./lib/auth";
import errorHandler from "./middlewares/errorHandler";
import notFound from "./middlewares/notFound";
import rateLimiter from "./middlewares/rateLimiter";
import router from "./routes/router";
import { loginController } from "./modules/auth/auth.controller";

const app = express();

app.use(helmet());
const allowedOrigins = Array.from(
  new Set([
    ...env.CLIENT_URL.split(",").map((u) => u.trim()),
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ])
).filter(Boolean);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
      if (
        env.NODE_ENV === "development" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(compression());
app.use(morgan("dev"));


// Mount custom auth routes before the generic Better Auth catch-all so
// /api/auth/login, /api/auth/signup, /api/auth/verify-otp and
// /api/auth/reset-password are handled by the app router first.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Authenticated and marketplace data must always reflect the current database.
// Prevent browsers from revalidating these responses as 304 Not Modified.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/api", rateLimiter(env.NODE_ENV === "development" ? 1000 : 100));
app.use("/api", router);

// Route Better Auth's direct email/password endpoint through the same
// account-status checks and automatic approval used by the app login form.
app.post("/api/auth/sign-in/email", loginController);
app.post("/api/auth/sign-up/email", (_req, res) => {
  res.status(403).json({
    success: false,
    message: "Use the Rahmah signup flow to create a student account or set up a pre-registered teacher account.",
  });
});
app.all("/api/auth/*", toNodeHandler(auth));

app.get("/health", (_req, res) =>
  res.json({
    success: true,
    message: "Rahmah Institute API is running",
    timestamp: new Date().toISOString(),
  })
);

app.use(notFound);
app.use(errorHandler);

export default app;









