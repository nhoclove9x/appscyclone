import { PrismaService } from "../database/prisma.service";
import { PasswordService } from "./password.service";
import { UsersService } from "./users.service";

interface CliInput {
  readonly email: string;
  readonly password: string;
}

function valueAfterFlag(
  args: readonly string[],
  flag: string,
): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readCliInput(): CliInput {
  const args = process.argv.slice(2);
  const email =
    valueAfterFlag(args, "--email") ?? process.env.PROVISION_USER_EMAIL;
  const password =
    valueAfterFlag(args, "--password") ?? process.env.PROVISION_USER_PASSWORD;

  if (email === undefined || email.trim().length === 0) {
    throw new Error("Missing --email or PROVISION_USER_EMAIL");
  }

  if (password === undefined || password.length === 0) {
    throw new Error("Missing --password or PROVISION_USER_PASSWORD");
  }

  return { email, password };
}

async function main(): Promise<void> {
  const input = readCliInput();
  const prisma = new PrismaService();
  const users = new UsersService(prisma, new PasswordService());

  try {
    const result = await users.provisionUser(input);

    if (result.status === "duplicate") {
      console.error("User already exists");
      process.exitCode = 1;
      return;
    }

    console.log(`Provisioned user ${result.user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Provisioning failed");
  process.exitCode = 1;
});
