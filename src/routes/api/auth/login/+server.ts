import { json } from "@sveltejs/kit";
import { SessionService } from "$lib/server/auth/session-service";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { verifyPassphrase } from "$lib/server/utils/passphrase";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { env } from "$env/dynamic/private";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";

const logger = new UniversalLogger().setContext("AuthLoginAPI");

registerOpenAPIRoute("/auth/login", "POST", {
  summary: "Login with WebAuthn passkey or passphrase",
  description:
    "Authenticate user with WebAuthn passkey or passphrase and create session. For WebAuthn, first call /auth/challenge to get a challenge.",
  tags: ["Authentication"],
  requestBody: {
    description: "Authentication data (either WebAuthn credential or passphrase)",
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
            passphrase: {
              type: "string",
              description: "User's passphrase (alternative to WebAuthn)",
              example: "my-secure-passphrase-123",
            },
            credential: {
              type: "object",
              description: "WebAuthn credential data (alternative to passphrase)",
              properties: {
                id: { type: "string", description: "Credential ID" },
                response: {
                  type: "object",
                  description: "WebAuthn response data",
                  properties: {
                    authenticatorData: {
                      type: "string",
                      description: "Base64 encoded authenticator data",
                    },
                    signature: { type: "string", description: "Base64 encoded signature" },
                    userHandle: { type: "string", description: "User handle" },
                    clientDataJSON: {
                      type: "string",
                      description: "Base64 encoded client data JSON",
                    },
                  },
                  required: ["authenticatorData", "signature", "clientDataJSON"],
                },
              },
              required: ["id", "response"],
            },
          },
          required: ["email"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Login successful",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string", description: "User ID" },
                  email: { type: "string", description: "User email" },
                  name: { type: "string", description: "User name" },
                  role: { type: "string", enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"] },
                  tenantId: { type: "string", description: "Tenant ID (if applicable)" },
                },
                required: ["id", "email", "name", "role"],
              },
              expiresAt: {
                type: "string",
                format: "date-time",
                description: "Session expiration time",
              },
            },
            required: ["message", "user", "expiresAt"],
          },
        },
      },
    },
    "400": {
      description: "Invalid credentials or request data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "401": {
      description: "Authentication failed",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
  },
});

export const POST: RequestHandler = async ({ request, cookies, getClientAddress, url }) => {
  try {
    const body = await request.json();
    const ipAddress = getClientAddress();
    const userAgent = request.headers.get("user-agent");

    logger.debug("Login attempt", {
      email: body.email,
      ipAddress,
      authMethod: body.passphrase ? "passphrase" : "webauthn",
    });

    // Validate that either passphrase or credential is provided
    if (!body.passphrase && !body.credential) {
      return json(
        { error: "Either passphrase or WebAuthn credential must be provided" },
        { status: 400 },
      );
    }

    // Get user by email
    let user;
    try {
      user = await UserService.getUserByEmail(body.email);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return json({ error: "Invalid email or authentication method" }, { status: 401 });
      }
      throw error;
    }

    // Production-only: Validate subdomain for non-global admins
    if (env.NODE_ENV === "production") {
      const hostname = url.hostname;
      const hostParts = hostname.split(".");
      const hasSubdomain = hostParts.length > 2;
      const subdomain = hasSubdomain ? hostParts[0] : null;

      // Global admins can login from anywhere
      if (user.role !== "GLOBAL_ADMIN") {
        if (!hasSubdomain || !subdomain) {
          logger.warn("Login attempt from non-subdomain by non-global admin", {
            userId: user.id,
            email: user.email,
            hostname,
            role: user.role,
          });
          return json({ error: "Unknown user does for tenant" }, { status: 401 });
        }

        if (user.tenantId) {
          try {
            const tenantService = await TenantAdminService.getTenantById(user.tenantId);
            const tenant = tenantService.tenantData;

            if (!tenant || tenant.shortName !== subdomain) {
              logger.warn("Login attempt from wrong subdomain", {
                userId: user.id,
                email: user.email,
                expectedSubdomain: tenant?.shortName,
                actualSubdomain: subdomain,
                tenantId: user.tenantId,
              });
              return json({ error: "Unknown user does for tenant" }, { status: 401 });
            }
          } catch (error) {
            logger.error("Failed to validate tenant for subdomain login", {
              userId: user.id,
              tenantId: user.tenantId,
              subdomain,
              error: String(error),
            });
            return json({ error: "Unknown user does for tenant" }, { status: 401 });
          }
        } else {
          logger.warn("Login attempt from subdomain by user without matching tenant", {
            userId: user.id,
            email: user.email,
            subdomain,
            role: user.role,
          });
          return json({ error: "Unknown user does for tenant" }, { status: 401 });
        }
      }
    }

    // Handle passphrase authentication
    if (body.passphrase) {
      if (!user.passphraseHash) {
        return json(
          { error: "Passphrase authentication not enabled for this user" },
          { status: 401 },
        );
      }

      const isPassphraseValid = await verifyPassphrase(user.passphraseHash, body.passphrase);
      if (!isPassphraseValid) {
        return json({ error: "Invalid passphrase" }, { status: 401 });
      }

      logger.debug("Passphrase authentication successful", { userId: user.id });
    }

    // Handle WebAuthn authentication
    if (body.credential) {
      // Get the challenge from the session
      const challengeFromSession = cookies.get("webauthn-challenge");
      if (!challengeFromSession) {
        return json(
          { error: "No WebAuthn challenge found. Please request a new challenge." },
          { status: 400 },
        );
      }

      // Clear the challenge cookie after use
      cookies.delete("webauthn-challenge", { path: "/" });

      const verificationResult = await WebAuthnService.verifyAuthentication(
        body.credential,
        challengeFromSession,
      );

      if (!verificationResult.verified) {
        // Record failed passkey attempt
        await challengeThrottleService.recordFailedAttempt(body.email, "passkey");
        return json({ error: "Invalid WebAuthn credential" }, { status: 401 });
      }

      // Verify that the credential belongs to the user
      if (verificationResult.userId !== user.id) {
        return json({ error: "WebAuthn credential does not belong to this user" }, { status: 401 });
      }

      // Update the counter to prevent replay attacks
      if (verificationResult.newCounter && verificationResult.passkeyId) {
        await WebAuthnService.updatePasskeyCounter(
          verificationResult.passkeyId,
          verificationResult.newCounter,
        );
      }

      logger.debug("WebAuthn authentication successful", { userId: user.id });

      // Clear throttle on successful authentication
      await challengeThrottleService.clearThrottle(body.email, "passkey");
    }

    const sessionData = await SessionService.createSession(
      user.id,
      ipAddress,
      userAgent || undefined,
    );

    // Set HTTP-only cookie for access token
    cookies.set("access_token", sessionData.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    logger.info("Login successful", {
      userId: sessionData.user.id,
      email: sessionData.user.email,
      role: sessionData.user.role,
      authMethod: body.passphrase ? "passphrase" : "webauthn",
    });

    return json({
      message: "Login successful",
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        name: sessionData.user.name,
        role: sessionData.user.role,
        tenantId: sessionData.user.tenantId,
      },
      expiresAt: sessionData.expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error("Login error:", { error: String(error) });

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({ error: "Authentication failed" }, { status: 401 });
  }
};
