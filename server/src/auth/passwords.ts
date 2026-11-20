// Password hashing with Node's built-in scrypt (no extra packages needed).
// Stored format: "scrypt$<salt hex>$<hash hex>"

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16); // a fresh random salt per password
  const hash = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  // Compare in constant time so the response time doesn't leak how close a guess was.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// A real hash of a throwaway password. Login checks against this when the
// email doesn't exist, so "no such user" takes as long as "wrong password".
export const DUMMY_HASH_PROMISE = hashPassword(randomBytes(16).toString("hex"));
