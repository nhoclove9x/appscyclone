import { Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "./users.service";
import { UsersService } from "./users.service";
import { PasswordService } from "./password.service";

export type LoginResult =
  | { readonly status: "success"; readonly user: AuthenticatedUser }
  | { readonly status: "invalid_credentials" }
  | { readonly status: "disabled" };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
  ) {}

  async validateLogin(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByNormalizedEmail(email);

    if (user === null) {
      return { status: "invalid_credentials" };
    }

    if (user.disabled) {
      return { status: "disabled" };
    }

    const validPassword = await this.passwords.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!validPassword) {
      return { status: "invalid_credentials" };
    }

    return {
      status: "success",
      user: {
        id: user.id,
        email: user.email,
        disabled: user.disabled,
      },
    };
  }
}
