import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

const validateRequest = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      if (req.method === "PATCH" && req.path.startsWith("/users/")) {
      }
      if (req.method === "POST" && req.path === "/chats") {
      }
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
      return;
    }

    req.validated = result.data as typeof req.validated;
    next();
  };
};

export default validateRequest;
