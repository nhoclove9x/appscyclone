import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes passwords with Argon2id and verifies them", async () => {
    const hash = await service.hashPassword("correct horse battery staple");

    expect(hash).toContain("$argon2id$");
    await expect(
      service.verifyPassword(hash, "correct horse battery staple"),
    ).resolves.toBe(true);
    await expect(service.verifyPassword(hash, "wrong password")).resolves.toBe(
      false,
    );
  });
});
