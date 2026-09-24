import { z } from "zod";

const environmentSchema = z
  .object({
    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "must be a PostgreSQL connection URL",
      ),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    SESSION_COOKIE_NAME: z.string().min(1).default("appcyclone.sid"),
    SESSION_SECRET: z.string().min(32),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(60).default(28_800),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
  })
  .superRefine((environment, context) => {
    if (environment.NODE_ENV !== "production") {
      return;
    }

    const lowerSecret = environment.SESSION_SECRET.toLowerCase();
    const unsafeFragments = [
      "replace-with",
      "change-me",
      "session-secret",
      "test-session",
      "development",
      "password",
    ];
    const repeatedSingleCharacter = /^(.)(\1)+$/u.test(
      environment.SESSION_SECRET,
    );

    if (
      repeatedSingleCharacter ||
      unsafeFragments.some((fragment) => lowerSecret.includes(fragment))
    ) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_SECRET"],
        message: "production session secret must be a strong external secret",
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  configuration: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(configuration);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].filter((field) => field.length > 0);

    throw new Error(
      `Invalid environment configuration: ${fields.join(", ") || "unknown field"}`,
    );
  }

  return result.data;
}
