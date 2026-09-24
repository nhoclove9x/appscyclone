import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "./App";
import { QueryProvider } from "./QueryProvider";

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </MemoryRouter>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("application auth routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    new QueryClient().clear();
  });

  it("redirects protected routes to login as session expired on auth 401", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, {
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      }),
    );

    renderApp("/");

    expect(
      await screen.findByText("Your session expired. Please sign in again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sign in to portfolio analytics" }),
    ).toBeInTheDocument();
  });

  it("shows invalid credentials on login 401 without session-expired messaging", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(401, {
          code: "UNAUTHENTICATED",
          message: "Authentication is required",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        }),
      );

    renderApp("/login");

    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "bad-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText("Your session expired. Please sign in again."),
      ).not.toBeInTheDocument();
    });
  });
});
