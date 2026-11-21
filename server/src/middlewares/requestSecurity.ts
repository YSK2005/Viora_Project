import { ErrorCode } from "../utils/errorCodes";
import { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "./errorHandler";

export const createAuthLimiter = (limit = 20, windowMs = 15 * 60_000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError(
          "Too many sign-in attempts. Try again later.",
          429,
          ErrorCode.ERR_RATE_LIMIT,
        ),
      ),
  });
export const apiLimiter = () =>
  rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError(
          "Too many requests. Try again shortly.",
          429,
          ErrorCode.ERR_RATE_LIMIT,
        ),
      ),
  });

// Validate structure without changing passwords, invoice text, or signed request keys.
export const sanitizeBody: RequestHandler = (req, _res, next) => {
  function inspect(value: unknown, depth = 0): void {
    if (depth > 25)
      throw new AppError(
        "Request is nested too deeply",
        400,
        ErrorCode.ERR_INVALID_BODY,
      );
    if (typeof value === "string" && value.includes("\0"))
      throw new AppError(
        "Null characters are not allowed",
        400,
        ErrorCode.ERR_INVALID_BODY,
      );
    if (Array.isArray(value)) {
      for (const item of value) inspect(item, depth + 1);
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new AppError(
            "Unsafe request property",
            400,
            ErrorCode.ERR_INVALID_BODY,
          );
        inspect(item, depth + 1);
      }
    }
  }
  try {
    inspect(req.body);
    next();
  } catch (error) {
    next(error);
  }
};
