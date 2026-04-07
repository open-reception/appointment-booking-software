import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { env } from "$env/dynamic/private";
import { UniversalLogger } from "$lib/logger";
import { bookingAccessTokenStore } from "$lib/server/services/booking-access-token-store";

const logger = new UniversalLogger().setContext("BookingAccessToken");

const BOOKING_ACCESS_EXPIRES = "10m";
const BOOKING_ACCESS_TTL_MS = 10 * 60 * 1000;
export const EXISTING_CLIENT_BOOKING_SCOPE = "appointments:client";
export const NEW_CLIENT_BOOTSTRAP_SCOPE = "appointments:new-client-bootstrap";
export type BookingAccessScope =
  | typeof EXISTING_CLIENT_BOOKING_SCOPE
  | typeof NEW_CLIENT_BOOTSTRAP_SCOPE;

if (!env.JWT_SECRET) {
  throw new Error("Mandatory ENV variable JWT_SECRET is missing!");
}

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

export interface BookingAccessTokenPayload {
  tenantId: string;
  emailHash?: string;
  tunnelId: string;
  clientPublicKey?: string;
  scope: BookingAccessScope;
  jti?: string;
  iat?: number;
  exp?: number;
}

async function signBookingAccessToken(payload: {
  tenantId: string;
  emailHash?: string;
  tunnelId: string;
  clientPublicKey?: string;
  scope: BookingAccessScope;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + BOOKING_ACCESS_TTL_MS);

  const token = await new SignJWT({
    tenantId: payload.tenantId,
    emailHash: payload.emailHash,
    tunnelId: payload.tunnelId,
    clientPublicKey: payload.clientPublicKey,
    scope: payload.scope,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(BOOKING_ACCESS_EXPIRES)
    .sign(JWT_SECRET);

  await bookingAccessTokenStore.store({
    id: jti,
    scope: payload.scope,
    tenantId: payload.tenantId,
    emailHash: payload.emailHash,
    tunnelId: payload.tunnelId,
    clientPublicKey: payload.clientPublicKey,
    expiresAt,
  });

  return token;
}

export async function generateBookingAccessToken(payload: {
  tenantId: string;
  emailHash: string;
  tunnelId: string;
}): Promise<string> {
  return await signBookingAccessToken({
    ...payload,
    scope: EXISTING_CLIENT_BOOKING_SCOPE,
  });
}

export async function generateNewClientBootstrapToken(payload: {
  tenantId: string;
  tunnelId: string;
  clientPublicKey: string;
  emailHash?: string;
}): Promise<string> {
  return await signBookingAccessToken({
    ...payload,
    scope: NEW_CLIENT_BOOTSTRAP_SCOPE,
  });
}

export async function verifyBookingAccessToken(
  token: string,
): Promise<BookingAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (
      typeof payload.tenantId !== "string" ||
      typeof payload.tunnelId !== "string" ||
      typeof payload.jti !== "string" ||
      (payload.scope !== EXISTING_CLIENT_BOOKING_SCOPE &&
        payload.scope !== NEW_CLIENT_BOOTSTRAP_SCOPE)
    ) {
      logger.warn("Invalid booking access token payload");
      return null;
    }

    const isActive = await bookingAccessTokenStore.isActive({
      id: payload.jti,
      tenantId: payload.tenantId,
      scope: payload.scope,
    });
    if (!isActive) {
      logger.warn("Booking access token is not active", {
        tenantId: payload.tenantId,
        jti: payload.jti,
        scope: payload.scope,
      });
      return null;
    }

    if (payload.scope === EXISTING_CLIENT_BOOKING_SCOPE && typeof payload.emailHash !== "string") {
      logger.warn("Existing client booking access token missing emailHash");
      return null;
    }

    if (
      payload.scope === NEW_CLIENT_BOOTSTRAP_SCOPE &&
      typeof payload.clientPublicKey !== "string"
    ) {
      logger.warn("New client bootstrap token missing clientPublicKey");
      return null;
    }

    return {
      tenantId: payload.tenantId,
      emailHash: payload.emailHash as string | undefined,
      tunnelId: payload.tunnelId,
      clientPublicKey: payload.clientPublicKey as string | undefined,
      scope: payload.scope,
      jti: payload.jti,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    logger.warn("Booking access token verification failed", { error: String(error) });
    return null;
  }
}

export async function consumeBookingAccessToken(payload: BookingAccessTokenPayload): Promise<void> {
  if (!payload.jti) {
    return;
  }

  const consumed = await bookingAccessTokenStore.consume({
    id: payload.jti,
    tenantId: payload.tenantId,
    scope: payload.scope,
  });

  if (!consumed) {
    logger.warn("Booking access token could not be consumed", {
      tenantId: payload.tenantId,
      jti: payload.jti,
      scope: payload.scope,
    });
  }
}
