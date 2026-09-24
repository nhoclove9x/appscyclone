import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  it("returns typed defaults for valid database configuration", () => {
    expect(
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
        SESSION_SECRET: "a".repeat(32),
      }),
    ).toEqual({
      ALLOWED_ORIGINS: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
      NODE_ENV: "development",
      PORT: 3000,
      SESSION_COOKIE_NAME: "AppsCyclone.sid",
      SESSION_SECRET: "a".repeat(32),
      SESSION_TTL_SECONDS: 28_800,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it("rejects missing database configuration without exposing values", () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: "test", SESSION_SECRET: "a".repeat(32) }),
    ).toThrow("Invalid environment configuration: DATABASE_URL");
  });

  it("rejects non-PostgreSQL connection URLs", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "https://example.com/database",
        SESSION_SECRET: "a".repeat(32),
      }),
    ).toThrow("Invalid environment configuration: DATABASE_URL");
  });

  it("rejects short session secrets", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
        SESSION_SECRET: "too-short",
      }),
    ).toThrow("Invalid environment configuration: SESSION_SECRET");
  });

  it("rejects obvious production session-secret placeholders", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
        NODE_ENV: "production",
        SESSION_SECRET: "replace-with-at-least-32-random-characters",
      }),
    ).toThrow("Invalid environment configuration: SESSION_SECRET");
  });

  it("accepts production with a non-placeholder session secret and one trusted proxy hop", () => {
    expect(
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
        NODE_ENV: "production",
        SESSION_SECRET: "prod_9x24QmV7nLr8sT6bY3pA5cD1eF0hJ2kM4qR6uW8z",
        TRUST_PROXY_HOPS: "1",
      }),
    ).toEqual(
      expect.objectContaining({
        NODE_ENV: "production",
        TRUST_PROXY_HOPS: 1,
      }),
    );
  });

  it("rejects broad proxy trust configuration", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
        SESSION_SECRET: "a".repeat(32),
        TRUST_PROXY_HOPS: "2",
      }),
    ).toThrow("Invalid environment configuration: TRUST_PROXY_HOPS");
  });
});
