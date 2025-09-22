import { randomBytes } from "node:crypto";
import { hash, verify } from "argon2";

/**
 * Generate a random recovery passphrase
 * Uses a combination of words and numbers for better memorability
 */
export function generateRecoveryPassphrase(): string {
  // Generate 16 random bytes and convert to base64
  const randomData = randomBytes(16);
  const base64 = randomData.toString("base64");

  // Convert to a more user-friendly format
  // Remove padding and special characters, add hyphens for readability
  const cleaned = base64.replace(/[+/=]/g, "").toLowerCase();

  // Split into groups of 4 characters with hyphens
  const groups = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    groups.push(cleaned.slice(i, i + 4));
  }

  return groups.join("-");
}

/**
 * Hash a passphrase using Argon2
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  return hash(passphrase, {
    type: 2, // Argon2id
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verify a passphrase against its hash
 */
export async function verifyPassphrase(hash: string, passphrase: string): Promise<boolean> {
  try {
    return await verify(hash, passphrase);
  } catch {
    return false;
  }
}

/**
 * Validate passphrase strength (minimum requirements)
 */
export function validatePassphraseStrength(passphrase: string): boolean {
  // Minimum 12 characters for security
  if (passphrase.length < 12) {
    return false;
  }

  // No additional complexity requirements for passphrases
  // (they can be long sentences)
  return true;
}
