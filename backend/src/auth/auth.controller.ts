import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ConfigService } from "@nestjs/config";

import { authErrorBody } from "./auth.errors";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { Environment } from "../config/environment";
import type {
  AuthenticatedRequest,
  RequestWithSession,
} from "./authenticated-request";
import { isNonEmptyString } from "./email";
import {
  destroySession,
  regenerateSession,
  saveSession,
} from "./session/session-promises";

interface LoginBody {
  readonly email: string;
  readonly password: string;
}

function parseLoginBody(value: unknown): LoginBody | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    "password" in value &&
    isNonEmptyString(value.email) &&
    isNonEmptyString(value.password)
  ) {
    return {
      email: value.email,
      password: value.password,
    };
  }

  return null;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: RequestWithSession,
  ): Promise<{
    readonly user: { readonly id: string; readonly email: string };
  }> {
    const parsed = parseLoginBody(body);

    if (parsed === null) {
      throw new BadRequestException(
        authErrorBody("INVALID_REQUEST", "Email and password are required"),
      );
    }

    const result = await this.auth.validateLogin(parsed.email, parsed.password);

    if (result.status === "invalid_credentials") {
      throw new UnauthorizedException(
        authErrorBody("INVALID_CREDENTIALS", "Invalid email or password"),
      );
    }

    if (result.status === "disabled") {
      throw new UnauthorizedException(
        authErrorBody("ACCOUNT_DISABLED", "Account is disabled"),
      );
    }

    await regenerateSession(request);
    request.session.userId = result.user.id;
    await saveSession(request);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
      },
    };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: RequestWithSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.session.userId !== undefined) {
      await destroySession(request);
    }

    response.clearCookie(
      this.config.get("SESSION_COOKIE_NAME", { infer: true }),
      { path: "/" },
    );
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest): {
    readonly user: { readonly id: string; readonly email: string };
  } {
    return {
      user: {
        id: request.user.id,
        email: request.user.email,
      },
    };
  }
}
