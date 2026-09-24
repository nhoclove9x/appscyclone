import type { Request } from "express";

import type { AuthenticatedUser } from "./users.service";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export interface RequestWithSession extends Request {
  readonly session: Request["session"] & {
    userId?: string;
  };
}

export interface AuthenticatedRequest extends RequestWithSession {
  readonly user: AuthenticatedUser;
}

export function attachAuthenticatedUser(
  request: Request,
  user: AuthenticatedUser,
): asserts request is AuthenticatedRequest {
  Object.assign(request, { user });
}
