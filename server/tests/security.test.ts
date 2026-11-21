// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  sanitizeBody,
  createAuthLimiter,
} from "../src/middlewares/requestSecurity";
import { retryRead } from "../src/utils/retryRead";
import { validateAndNormalizeGSTIN } from "../src/utils/validators";
import express from "express";
import { errorHandler } from "../src/middlewares/errorHandler";
describe("request security", () => {
  it("rejects prototype keys without modifying passwords", () => {
    const next = vi.fn();
    sanitizeBody(
      { body: JSON.parse('{"__proto__":{"admin":true}}') } as never,
      {} as never,
      next,
    );
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    const request = { body: { password: "<Secret>123456!" } };
    const safe = vi.fn();
    sanitizeBody(request as never, {} as never, safe);
    expect(safe).toHaveBeenCalledWith();
    expect(request.body.password).toBe("<Secret>123456!");
  });
  it("retries transient reads but never validation failures", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce({ code: "P1001" })
      .mockResolvedValue(42);
    expect(await retryRead(read)).toBe(42);
    expect(read).toHaveBeenCalledTimes(2);
    const invalid = vi.fn().mockRejectedValue({ code: "P2002" });
    await expect(retryRead(invalid)).rejects.toEqual({ code: "P2002" });
    expect(invalid).toHaveBeenCalledTimes(1);
  });
  it("enforces rate limit and exposes retry headers", async () => {
    const app = express();
    app.use(createAuthLimiter(2, 10000));
    app.get("/", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const url =
        "http://127.0.0.1:" + (server.address() as { port: number }).port;
      expect((await fetch(url)).status).toBe(200);
      expect((await fetch(url)).status).toBe(200);
      const limited = await fetch(url);
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).not.toBeNull();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("enforces GSTIN structure and normalization", () => {
    expect(validateAndNormalizeGSTIN("29abcde1234f1z5")).toBe(
      "29ABCDE1234F1Z5",
    );
    expect(() => validateAndNormalizeGSTIN("29ABCDE1234F0Z5")).toThrow();
    expect(() => validateAndNormalizeGSTIN("<script>")).toThrow();
  });
});
