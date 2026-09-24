import type { NextFunction, Request, Response } from "express";

import type { Environment } from "../config/environment";
import { authErrorBody } from "./auth.errors";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function allowedOriginsFrom(
  environment: Environment,
): ReadonlySet<string> {
  return new Set(
    environment.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}

export function createOriginValidationMiddleware(environment: Environment) {
  const allowedOrigins = allowedOriginsFrom(environment);

  return (request: Request, response: Response, next: NextFunction): void => {
    if (!UNSAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.header("origin");

    if (origin !== undefined && allowedOrigins.has(origin)) {
      next();
      return;
    }

    response
      .status(403)
      .json(authErrorBody("INVALID_ORIGIN", "Request origin is not allowed"));
  };
}
