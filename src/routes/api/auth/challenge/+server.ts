import { json } from "@sveltejs/kit";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { UserService } from "$lib/server/services/user-service";
import {
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";
import type { Cookies } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";
import { env } from "$env/dynamic/private";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";
import { verifyRegistrationBootstrapToken } from "$lib/server/auth/registration-bootstrap";
import { normalizeEmail } from "$lib/utils";

const logger = new UniversalLogger().setContext("AuthChallengeAPI");

registerOpenAPIRoute("/auth/challenge", "POST", {
  summary: "Generate WebAuthn authentication challenge",
  description:
    "Generate a challenge for WebAuthn authentication (login) or registration and return registered passkeys if user exists",
  tags: ["Authentication"],
  requestBody: {
    description: "User email to generate challenge for",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
              example: "admin@example.com",
            },
            userId: {
              type: "string",
              format: "uuid",
              description:
                "Optional user ID for registration setup flows. If provided, it must match the confirmed account.",
            },
          },
          required: ["email"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Challenge generated successfully for login or registration",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              challenge: {
                type: "string",
                description: "Base64url encoded challenge",
              },
              allowCredentials: {
                type: "array",
                description: "List of registered passkeys for this user (empty for registration)",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", description: "Credential ID" },
                    type: { type: "string", enum: ["public-key"] },
                    transports: {
                      type: "array",
                      items: { type: "string" },
                      description: "Supported transports",
                    },
                  },
                },
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds",
              },
              isRegistration: {
                type: "boolean",
                description: "True if this is for user registration (user not found)",
              },
            },
            required: ["challenge", "allowCredentials"],
          },
        },
      },
    },
    "429": {
      description: "Too many failed attempts - rate limited",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string", description: "Error message" },
              retryAfterMs: {
                type: "number",
                description: "Milliseconds to wait before retrying",
              },
            },
          },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Internal server error" },
        },
      },
    },
  },
});

/**
 * Get the appropriate rpId (Relying Party ID) for WebAuthn based on environment
 */
function getRpId(requestUrl: URL): string {
  if (env.NODE_ENV === "production") {
    // In production, use the hostname (without subdomain for main domain)
    const hostname = requestUrl.hostname;
    const parts = hostname.split(".");

    // If it's a subdomain (e.g., tenant.example.com), use the main domain (example.com)
    // This allows passkeys to work across all subdomains
    if (parts.length > 2) {
      return parts.slice(-2).join(".");
    }
    return hostname;
  }

  // Development: use localhost
  return "localhost";
}

async function validateRegistrationBootstrapSession(input: {
  cookies: Cookies;
  userId: string;
  userEmail: string;
  requestEmail: string;
  requestUserId?: string;
}): Promise<void> {
  const bootstrapPayload = await verifyRegistrationBootstrapToken(
    input.cookies.get("webauthn-registration-bootstrap"),
  );

  const bootstrapIsValid =
    !!bootstrapPayload &&
    bootstrapPayload.userId === input.userId &&
    bootstrapPayload.email === normalizeEmail(input.userEmail) &&
    bootstrapPayload.email === normalizeEmail(input.requestEmail) &&
    (!input.requestUserId || input.requestUserId === input.userId);

  if (!bootstrapIsValid) {
    logger.warn("Registration challenge rejected due to invalid bootstrap session", {
      email: input.requestEmail,
      requestUserId: input.requestUserId,
      targetUserId: input.userId,
      hasBootstrapCookie: !!input.cookies.get("webauthn-registration-bootstrap"),
    });

    throw new ValidationError("Invalid or missing registration bootstrap session");
  }
}

function parseChallengeRequest(body: unknown): { requestEmail: string; requestUserId?: string } {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Valid email is required");
  }

  const parsedBody = body as { email?: unknown; userId?: unknown };
  const requestEmail =
    typeof parsedBody.email === "string" ? normalizeEmail(parsedBody.email) : undefined;

  if (!requestEmail) {
    throw new ValidationError("Valid email is required");
  }

  const requestUserId = typeof parsedBody.userId === "string" ? parsedBody.userId : undefined;

  return { requestEmail, requestUserId };
}

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const body = await request.json();
    const { requestEmail, requestUserId } = parseChallengeRequest(body);

    logger.debug("Generating WebAuthn challenge", { email: requestEmail, requestUserId });

    // Check throttling for passkey challenges
    const throttleResult = await challengeThrottleService.checkThrottle(requestEmail, "passkey");

    if (!throttleResult.allowed) {
      logger.warn("Passkey challenge throttled", {
        email: requestEmail,
        retryAfterMs: throttleResult.retryAfterMs,
        failedAttempts: throttleResult.failedAttempts,
      });

      return json(
        {
          error: "Too many failed attempts. Please try again later.",
          retryAfterMs: throttleResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(throttleResult.retryAfterMs / 1000).toString(),
          },
        },
      );
    }

    // Try to get user by email - but don't fail if not found
    let user = null;
    let isRegistration = false;

    try {
      user = await UserService.getUserByEmail(requestEmail);
      const passkeys = await UserService.getUserPasskeys(user.id);
      if (passkeys.length === 0) {
        isRegistration = true; // User exists but has no passphrase - must register
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        // User doesn't exist yet - this is a registration flow
        isRegistration = true;
        logger.debug("User not found - generating challenge for registration", {
          email: requestEmail,
        });
      } else {
        throw error;
      }
    }

    if (isRegistration && user) {
      await validateRegistrationBootstrapSession({
        cookies,
        userId: user.id,
        userEmail: user.email,
        requestEmail,
        requestUserId,
      });
    }

    // Generate challenge
    const challenge = WebAuthnService.generateChallenge();

    if (isRegistration) {
      cookies.set("webauthn-registration-email", requestEmail, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 5, // 5 minutes
      });
    }
    // For login and registration, store the challenge for signature verification
    cookies.set("webauthn-challenge", challenge, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 5, // 5 minutes
    });

    let allowCredentials: Array<{
      id: string;
      type: "public-key";
      transports: string[];
    }> = [];

    if (user) {
      // Get user's registered passkeys for login
      const passkeys = await WebAuthnService.getUserPasskeys(user.id);

      allowCredentials = passkeys.map((passkey) => ({
        id: passkey.id,
        type: "public-key" as const,
        transports: ["usb", "nfc", "ble", "internal"],
      }));

      logger.debug("WebAuthn challenge generated for login", {
        userId: user.id,
        email: user.email,
        passkeyCount: passkeys.length,
        challenge: challenge.substring(0, 8) + "...",
      });
    } else {
      logger.debug("WebAuthn challenge generated for registration", {
        email: requestEmail,
        challenge: challenge.substring(0, 8) + "...",
      });
    }

    const rpId = getRpId(url);

    logger.debug("Returning challenge data", {
      challenge,
      allowCredentials,
      timeout: 60000, // 60 seconds
      rpId,
      userVerification: "preferred",
      isRegistration,
    });

    return json({
      challenge,
      allowCredentials,
      timeout: 60000, // 60 seconds
      rpId,
      userVerification: "preferred",
      isRegistration,
    });
  } catch (error) {
    logError(logger)("Failed to generate WebAuthn challenge", error);
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
