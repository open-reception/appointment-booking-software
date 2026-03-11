import { createHash } from "node:crypto";

export const NEW_CLIENT_BOOTSTRAP_DIFFICULTY = 4;

export function createBootstrapBinding(input: {
  tenantId: string;
  tunnelId: string;
  clientPublicKey: string;
  emailHash?: string;
}): string {
  return createHash("sha256")
    .update(
      [input.tenantId, input.tunnelId, input.clientPublicKey, input.emailHash ?? ""].join(":"),
      "utf8",
    )
    .digest("hex");
}

export function createBootstrapPowDigest(input: {
  nonce: string;
  tunnelId: string;
  clientPublicKey: string;
  counter: number;
}): string {
  return createHash("sha256")
    .update(
      [input.nonce, input.tunnelId, input.clientPublicKey, input.counter.toString()].join(":"),
      "utf8",
    )
    .digest("hex");
}

export function matchesPowDifficulty(digest: string, difficulty: number): boolean {
  return digest.startsWith("0".repeat(difficulty));
}