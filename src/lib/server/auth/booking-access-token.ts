import { SignJWT, jwtVerify } from "jose";
import { env } from "$env/dynamic/private";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("BookingAccessToken");

const BOOKING_ACCESS_EXPIRES = "10m";
const BOOKING_SCOPE = "appointments:client";

if (!env.JWT_SECRET) {
  throw new Error("Mandatory ENV variable JWT_SECRET is missing!");
}

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

export interface BookingAccessTokenPayload {
  tenantId: string;
  emailHash: string;
  tunnelId: string;
  scope: typeof BOOKING_SCOPE;
  iat?: number;
  exp?: number;
}

export async function generateBookingAccessToken(payload: {
  tenantId: string;
  emailHash: string;
  tunnelId: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    tenantId: payload.tenantId,
    emailHash: payload.emailHash,
    tunnelId: payload.tunnelId,
    scope: BOOKING_SCOPE,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(BOOKING_ACCESS_EXPIRES)
    .sign(JWT_SECRET);
}

export async function verifyBookingAccessToken(
  token: string,
): Promise<BookingAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (
      typeof payload.tenantId !== "string" ||
      typeof payload.emailHash !== "string" ||
      typeof payload.tunnelId !== "string" ||
      payload.scope !== BOOKING_SCOPE
    ) {
      logger.warn("Invalid booking access token payload");
      return null;
    }

    return {
      tenantId: payload.tenantId,
      emailHash: payload.emailHash,
      tunnelId: payload.tunnelId,
      scope: BOOKING_SCOPE,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    logger.warn("Booking access token verification failed", { error: String(error) });
    return null;
  }
}
