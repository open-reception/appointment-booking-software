import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "$env/dynamic/private";
import { UniversalLogger } from "$lib/logger";
import { normalizeEmail } from "$lib/utils";

const logger = new UniversalLogger().setContext("RegistrationBootstrap");

const REGISTRATION_BOOTSTRAP_TYPE = "webauthn-registration-bootstrap";
const REGISTRATION_BOOTSTRAP_EXPIRES = "15m";

type RegistrationBootstrapPayload = {
  userId: string;
  email: string;
  type: typeof REGISTRATION_BOOTSTRAP_TYPE;
};

const getJwtSecret = (): Uint8Array | null => {
  if (!env.JWT_SECRET) {
    logger.error("JWT_SECRET missing while handling registration bootstrap token");
    return null;
  }

  return new TextEncoder().encode(env.JWT_SECRET);
};

export async function generateRegistrationBootstrapToken(input: {
  userId: string;
  email: string;
}): Promise<string | null> {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: RegistrationBootstrapPayload = {
    userId: input.userId,
    email: normalizeEmail(input.email),
    type: REGISTRATION_BOOTSTRAP_TYPE,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(REGISTRATION_BOOTSTRAP_EXPIRES)
    .sign(jwtSecret);
}

export async function verifyRegistrationBootstrapToken(
  token?: string,
): Promise<{ userId: string; email: string } | null> {
  if (!token) {
    return null;
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    const typedPayload = payload as JWTPayload & Partial<RegistrationBootstrapPayload>;

    if (
      typedPayload.type !== REGISTRATION_BOOTSTRAP_TYPE ||
      typeof typedPayload.userId !== "string" ||
      typeof typedPayload.email !== "string"
    ) {
      return null;
    }

    return {
      userId: typedPayload.userId,
      email: normalizeEmail(typedPayload.email),
    };
  } catch {
    return null;
  }
}
