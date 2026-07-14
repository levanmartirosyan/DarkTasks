import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const keyLength = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, keyLength).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const candidate = Buffer.from(scryptSync(password, salt, keyLength).toString("hex"), "hex");
  const stored = Buffer.from(storedHash, "hex");

  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
