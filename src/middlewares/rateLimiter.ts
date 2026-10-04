import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    const entry = rateLimitMap.get(key)!;

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      next();
      return;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
      });
      return;
    }

    next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60000);

export default rateLimiter;
