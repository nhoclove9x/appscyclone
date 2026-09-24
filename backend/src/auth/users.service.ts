import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { normalizeEmail } from "./email";
import { PasswordService } from "./password.service";

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly disabled: boolean;
}

export interface ProvisionUserInput {
  readonly email: string;
  readonly password: string;
}

export type ProvisionUserResult =
  | { readonly status: "created"; readonly user: AuthenticatedUser }
  | { readonly status: "duplicate" };

function toAuthenticatedUser(user: {
  readonly id: string;
  readonly email: string;
  readonly disabled: boolean;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    disabled: user.disabled,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async findByNormalizedEmail(
    email: string,
  ): Promise<(AuthenticatedUser & { readonly passwordHash: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    if (user === null) {
      return null;
    }

    return {
      ...toAuthenticatedUser(user),
      passwordHash: user.passwordHash,
    };
  }

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    return user === null ? null : toAuthenticatedUser(user);
  }

  async provisionUser(input: ProvisionUserInput): Promise<ProvisionUserResult> {
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwords.hashPassword(input.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      return { status: "created", user: toAuthenticatedUser(user) };
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return { status: "duplicate" };
      }

      throw error;
    }
  }
}
