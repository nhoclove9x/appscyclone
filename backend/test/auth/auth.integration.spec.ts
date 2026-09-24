import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHmac } from "node:crypto";
import { Server } from "node:http";
import request from "supertest";
import type { Agent } from "supertest";

import { PrismaService } from "../../src/database/prisma.service";
import { UsersService } from "../../src/auth";
import type { AppConfigurationTarget } from "../../src/main";

const databaseUrl = process.env.DATABASE_URL;
const allowedOrigin = "http://localhost:3000";
const lookalikeOrigin = "http://localhost:3000.evil.example";
const testSessionSecret = "test-session-secret-at-least-32-characters";

interface TestingAppOptions {
  readonly freshModules?: boolean;
  readonly nodeEnv?: "test" | "production";
  readonly sessionCookieName?: string;
  readonly sessionSecret?: string;
  readonly trustProxyHops?: number;
}

function requireDatabaseUrl(): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required for auth integration tests");
  }

  return databaseUrl;
}

async function createTestingApp(
  options: TestingAppOptions = {},
): Promise<INestApplication> {
  process.env.DATABASE_URL = requireDatabaseUrl();
  process.env.NODE_ENV = options.nodeEnv ?? "test";
  process.env.ALLOWED_ORIGINS = allowedOrigin;
  process.env.SESSION_COOKIE_NAME =
    options.sessionCookieName ?? "AppsCyclone.sid";
  process.env.SESSION_SECRET = options.sessionSecret ?? testSessionSecret;
  process.env.SESSION_TTL_SECONDS = "3600";
  process.env.TRUST_PROXY_HOPS = String(options.trustProxyHops ?? 0);

  if (options.freshModules === true) {
    jest.resetModules();
  }

  const [{ AppModule }, { configureApp }] = await Promise.all([
    import("../../src/app.module"),
    import("../../src/main"),
  ]);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  configureApp(app as unknown as AppConfigurationTarget, {
    trustProxyHops: options.trustProxyHops ?? 0,
  });
  await app.init();

  return app;
}

async function clearAuthTables(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "session", "users" RESTART IDENTITY CASCADE',
  );
}

function postWithOrigin(agent: Agent, url: string) {
  return agent.post(url).set("Origin", allowedOrigin);
}

function signSessionCookieValue(sid: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(sid)
    .digest("base64")
    .replace(/=+$/u, "");

  return encodeURIComponent(`s:${sid}.${signature}`);
}

function sessionIdFromSetCookie(setCookie: unknown): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const sessionCookie = cookies.find(
    (cookie): cookie is string =>
      typeof cookie === "string" && cookie.startsWith("AppsCyclone.sid="),
  );

  if (sessionCookie === undefined) {
    throw new Error("Expected AppsCyclone.sid Set-Cookie header");
  }

  const encodedCookieValue = sessionCookie
    .slice("AppsCyclone.sid=".length)
    .split(";")[0];

  if (encodedCookieValue === undefined) {
    throw new Error("Expected session cookie value");
  }

  const signedValue = decodeURIComponent(encodedCookieValue);

  if (!signedValue.startsWith("s:")) {
    throw new Error("Expected signed session cookie value");
  }

  const [sid] = signedValue.slice(2).split(".");

  if (sid === undefined || sid.length === 0) {
    throw new Error("Expected session ID in signed cookie value");
  }

  return sid;
}

function httpServerFrom(app: INestApplication): Server {
  const server: unknown = app.getHttpServer();

  if (server instanceof Server) {
    return server as Server;
  }

  throw new Error("Nest test app did not expose an HTTP server");
}

function expectUserEmail(body: unknown, email: string): void {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();

  const user = (body as { readonly user?: unknown }).user;

  expect(typeof user).toBe("object");
  expect(user).not.toBeNull();

  const typedUser = user as { readonly id?: unknown; readonly email?: unknown };

  expect(typeof typedUser.id).toBe("string");
  expect(typedUser.email).toBe(email);
}

function expectErrorCode(body: unknown, code: string): void {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();

  const errorBody = body as {
    readonly code?: unknown;
    readonly message?: unknown;
  };

  expect(errorBody.code).toBe(code);
  expect(typeof errorBody.message).toBe("string");
}

describe("session authentication", () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let users: UsersService;

  beforeAll(async () => {
    app = await createTestingApp();
    server = httpServerFrom(app);
    prisma = app.get(PrismaService);
    users = app.get(UsersService);
  });

  beforeEach(async () => {
    await clearAuthTables(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it("provisions a normalized user and rejects duplicates", async () => {
    const created = await users.provisionUser({
      email: "  Evaluator@Example.COM ",
      password: "password-one",
    });
    const duplicate = await users.provisionUser({
      email: "evaluator@example.com",
      password: "password-two",
    });

    expect(created.status).toBe("created");
    if (created.status !== "created") {
      throw new Error("Expected user to be created");
    }
    expect(created.user.email).toBe("evaluator@example.com");
    expect(duplicate).toEqual({ status: "duplicate" });
    await expect(prisma.user.count()).resolves.toBe(1);
  });

  it("logs in with normalized email and stores the session in PostgreSQL", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const agent = request.agent(server);

    const response = await postWithOrigin(agent, "/api/v1/auth/login").send({
      email: "  EVALUATOR@example.com ",
      password: "correct-password",
    });

    expect(response.status).toBe(200);
    expectUserEmail(response.body as unknown, "evaluator@example.com");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("AppsCyclone.sid=")]),
    );
    expect(String(response.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(response.headers["set-cookie"])).toContain("SameSite=Lax");
    const sessionRows = await prisma.$queryRaw<
      { sid: string }[]
    >`SELECT sid FROM "session"`;
    expect(sessionRows).toHaveLength(1);
    expect(typeof sessionRows[0]?.sid).toBe("string");
  });

  it("regenerates an existing unauthenticated session ID on successful login", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const fixedSid = "fixed-session-id-before-login";
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$executeRaw`
      INSERT INTO "session" ("sid", "sess", "expire")
      VALUES (
        ${fixedSid},
        ${JSON.stringify({
          cookie: {
            expires: expiresAt.toISOString(),
            httpOnly: true,
            originalMaxAge: 3_600_000,
            path: "/",
            sameSite: "lax",
            secure: false,
          },
        })}::json,
        ${expiresAt}
      )
    `;

    const response = await request(server)
      .post("/api/v1/auth/login")
      .set("Origin", allowedOrigin)
      .set(
        "Cookie",
        `AppsCyclone.sid=${signSessionCookieValue(fixedSid, testSessionSecret)}`,
      )
      .send({
        email: "evaluator@example.com",
        password: "correct-password",
      });

    const regeneratedSid = sessionIdFromSetCookie(
      response.headers["set-cookie"],
    );
    const sessionRows = await prisma.$queryRaw<
      { sid: string }[]
    >`SELECT sid FROM "session" ORDER BY sid`;

    expect(response.status).toBe(200);
    expect(regeneratedSid).not.toBe(fixedSid);
    expect(sessionRows.map(({ sid }) => sid)).toEqual([regeneratedSid]);
  });

  it("rejects invalid password and nonexistent user with stable errors", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const agent = request.agent(server);

    const invalidPassword = await postWithOrigin(
      agent,
      "/api/v1/auth/login",
    ).send({
      email: "evaluator@example.com",
      password: "wrong-password",
    });
    const nonexistentUser = await postWithOrigin(
      agent,
      "/api/v1/auth/login",
    ).send({
      email: "missing@example.com",
      password: "wrong-password",
    });

    expect(invalidPassword.status).toBe(401);
    expectErrorCode(invalidPassword.body as unknown, "INVALID_CREDENTIALS");
    expect(nonexistentUser.status).toBe(401);
    expectErrorCode(nonexistentUser.body as unknown, "INVALID_CREDENTIALS");
  });

  it("rejects disabled users at login", async () => {
    const result = await users.provisionUser({
      email: "disabled@example.com",
      password: "correct-password",
    });

    if (result.status !== "created") {
      throw new Error("Expected test user to be created");
    }

    await prisma.user.update({
      where: { id: result.user.id },
      data: { disabled: true },
    });

    const response = await postWithOrigin(
      request.agent(server),
      "/api/v1/auth/login",
    ).send({
      email: "disabled@example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(401);
    expectErrorCode(response.body as unknown, "ACCOUNT_DISABLED");
  });

  it("returns /auth/me for authenticated sessions and rejects unauthenticated sessions", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const unauthenticated = await request(server).get("/api/v1/auth/me");
    const agent = request.agent(server);

    await postWithOrigin(agent, "/api/v1/auth/login").send({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const authenticated = await agent.get("/api/v1/auth/me");

    expect(unauthenticated.status).toBe(401);
    expectErrorCode(unauthenticated.body as unknown, "UNAUTHENTICATED");
    expect(authenticated.status).toBe(200);
    expectUserEmail(authenticated.body as unknown, "evaluator@example.com");
  });

  it("disabling a user invalidates effective access for an existing session", async () => {
    const result = await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });

    if (result.status !== "created") {
      throw new Error("Expected test user to be created");
    }

    const agent = request.agent(server);
    await postWithOrigin(agent, "/api/v1/auth/login").send({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    await prisma.user.update({
      where: { id: result.user.id },
      data: { disabled: true },
    });

    const response = await agent.get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expectErrorCode(response.body as unknown, "ACCOUNT_DISABLED");
  });

  it("logout destroys the session", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const agent = request.agent(server);

    await postWithOrigin(agent, "/api/v1/auth/login").send({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const logout = await postWithOrigin(agent, "/api/v1/auth/logout").send({});
    const me = await agent.get("/api/v1/auth/me");

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
    await expect(prisma.$queryRaw`SELECT sid FROM "session"`).resolves.toEqual(
      [],
    );
  });

  it("rejects expired or invalid sessions", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const agent = request.agent(server);

    await postWithOrigin(agent, "/api/v1/auth/login").send({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    await prisma.$executeRaw`UPDATE "session" SET "expire" = NOW() - INTERVAL '1 hour'`;

    const response = await agent.get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expectErrorCode(response.body as unknown, "UNAUTHENTICATED");
  });

  it("allows exact configured origins and rejects mismatched lookalike origins", async () => {
    await users.provisionUser({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const agent = request.agent(server);

    const allowed = await postWithOrigin(agent, "/api/v1/auth/login").send({
      email: "evaluator@example.com",
      password: "correct-password",
    });
    const rejected = await request(server)
      .post("/api/v1/auth/login")
      .set("Origin", lookalikeOrigin)
      .send({
        email: "evaluator@example.com",
        password: "correct-password",
      });

    expect(allowed.status).toBe(200);
    expect(rejected.status).toBe(403);
    expectErrorCode(rejected.body as unknown, "INVALID_ORIGIN");
  });

  it("uses the existing connect-pg-simple session table shape", async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'session'
      ORDER BY ordinal_position`;

    expect(columns.map(({ column_name: columnName }) => columnName)).toEqual([
      "sid",
      "sess",
      "expire",
    ]);
  });

  it("sets Secure production cookies when directly behind one trusted HTTPS proxy", async () => {
    const productionApp = await createTestingApp({
      freshModules: true,
      nodeEnv: "production",
      sessionCookieName: "AppsCyclone.sid",
      sessionSecret: "prod_9x24QmV7nLr8sT6bY3pA5cD1eF0hJ2kM4qR6uW8z",
      trustProxyHops: 1,
    });
    const [
      { PrismaService: FreshPrismaService },
      { UsersService: FreshUsersService },
    ] = await Promise.all([
      import("../../src/database/prisma.service"),
      import("../../src/auth"),
    ]);
    const productionServer = httpServerFrom(productionApp);
    const productionPrisma = productionApp.get(FreshPrismaService);
    const productionUsers = productionApp.get(FreshUsersService);

    try {
      await clearAuthTables(productionPrisma);
      await productionUsers.provisionUser({
        email: "evaluator@example.com",
        password: "correct-password",
      });

      const response = await request(productionServer)
        .post("/api/v1/auth/login")
        .set("Origin", allowedOrigin)
        .set("X-Forwarded-Proto", "https")
        .send({
          email: "evaluator@example.com",
          password: "correct-password",
        });
      const setCookie = String(response.headers["set-cookie"]);

      expect(response.status).toBe(200);
      expect(setCookie).toContain("AppsCyclone.sid=");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
      expect(setCookie).toContain("Secure");
      expect(setCookie).toContain("Expires=");
    } finally {
      await productionApp.close();
    }
  });
});
