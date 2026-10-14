import { describe, expect, it } from "vitest";
import { generatePassword, generateToken, hashPassword, sha256, verifyPassword } from "@/lib/crypto";

describe("Passwörter", () => {
  it("hasht und prüft Passwörter", async () => {
    const hash = await hashPassword("ein langes Passwort");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("ein langes Passwort", hash)).toBe(true);
    expect(await verifyPassword("falsch", hash)).toBe(false);
  });

  it("erzeugt für gleiche Passwörter unterschiedliche Hashes", async () => {
    expect(await hashPassword("x".repeat(12))).not.toBe(await hashPassword("x".repeat(12)));
  });

  it("lehnt kaputte Hashes ab", async () => {
    expect(await verifyPassword("abc", null)).toBe(false);
    expect(await verifyPassword("abc", "bcrypt$foo")).toBe(false);
  });
});

describe("Tokens", () => {
  it("sind zufällig und URL-tauglich", () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(generateToken()).not.toBe(a);
    expect(sha256("a")).toHaveLength(64);
    expect(generatePassword(14)).toHaveLength(14);
  });
});
