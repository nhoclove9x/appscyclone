import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { authErrorBody } from "./auth.errors";
import { attachAuthenticatedUser } from "./authenticated-request";
import type { RequestWithSession } from "./authenticated-request";
import { UsersService } from "./users.service";

function requestFrom(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = requestFrom(context) as RequestWithSession;
    const userId = request.session.userId;

    if (userId === undefined) {
      throw new UnauthorizedException(
        authErrorBody("UNAUTHENTICATED", "Authentication is required"),
      );
    }

    const user = await this.users.findById(userId);

    if (user === null) {
      throw new UnauthorizedException(
        authErrorBody("UNAUTHENTICATED", "Authentication is required"),
      );
    }

    if (user.disabled) {
      throw new UnauthorizedException(
        authErrorBody("ACCOUNT_DISABLED", "Account is disabled"),
      );
    }

    attachAuthenticatedUser(request, user);
    return true;
  }
}
