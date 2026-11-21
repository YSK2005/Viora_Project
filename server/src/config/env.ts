import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    CLIENT_URL: z
      .string()
      .default("http://localhost:5173")
      .refine(
        (value) =>
          value.split(",").every((origin) => {
            try {
              const url = new URL(origin.trim());
              return (
                ["http:", "https:"].includes(url.protocol) &&
                url.origin === origin.trim().replace(/\/$/, "")
              );
            } catch {
              return false;
            }
          }),
        "Use comma-separated HTTP(S) origins without paths",
      ),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(ql)?:/.test(value),
        "PostgreSQL URL required",
      )
      .default(
        "postgresql://postgres:password@localhost:5432/viora_bills?schema=public",
      ),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production") {
      if (!process.env.DATABASE_URL)
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Required in production",
        });
      if (
        !value.CLIENT_URL.split(",").every((url) =>
          url.trim().startsWith("https://"),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["CLIENT_URL"],
          message: "HTTPS origins required in production",
        });
    }
  });
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
  );
  process.exit(1);
}
export const env = parsed.data;
