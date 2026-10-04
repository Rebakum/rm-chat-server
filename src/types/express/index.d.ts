import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
        role: string;
        status: string;
        [key: string]: unknown;
      };
      session?: {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
        [key: string]: unknown;
      };
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
