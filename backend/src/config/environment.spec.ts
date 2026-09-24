import { validateEnvironment } from "./environment";

describe("validateEnvironment", () => {
  it("returns typed defaults for valid database configuration", () => {
    expect(
      validateEnvironment({
        DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
      }),
    ).toEqual({
      DATABASE_URL: "postgresql://user:password@localhost:5432/portfolio",
      NODE_ENV: "development",
      PORT: 3000,
    });
  });

  it("rejects missing database configuration without exposing values", () => {
    expect(() => validateEnvironment({ NODE_ENV: "test" })).toThrow(
      "Invalid environment configuration: DATABASE_URL",
    );
  });

  it("rejects non-PostgreSQL connection URLs", () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: "https://example.com/database" }),
    ).toThrow("Invalid environment configuration: DATABASE_URL");
  });
});
