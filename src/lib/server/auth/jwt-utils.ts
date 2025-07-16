import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "$env/dynamic/private";
import type { SelectUser } from "$lib/server/db/central-schema";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("JWT");

export interface JWTTokens {
	accessToken: string;
	refreshToken: string;
}

const JWT_SECRET = new TextEncoder().encode(
	env.JWT_SECRET || "dev-secret-key-change-in-production-must-be-32-chars-minimum"
);
const ACCESS_TOKEN_EXPIRES = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRES = "7d"; // 7 days

export async function generateAccessToken(user: SelectUser, sessionId: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const payload: Omit<JWTPayload, "iat" | "exp"> = {
		userId: user.id,
		email: user.email,
		name: user.name,
		role: user.role,
		tenantId: user.tenantId || undefined,
		sessionId
	};

	const jwt = await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(now)
		.setExpirationTime(ACCESS_TOKEN_EXPIRES)
		.sign(JWT_SECRET);

	return jwt;
}

export async function generateRefreshToken(userId: string, sessionId: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);

	const payload = {
		userId,
		sessionId,
		type: "refresh"
	};

	const jwt = await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt(now)
		.setExpirationTime(REFRESH_TOKEN_EXPIRES)
		.sign(JWT_SECRET);

	return jwt;
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
	try {
		const { payload } = await jwtVerify(token, JWT_SECRET);

		return {
			userId: payload.userId,
			email: payload.email,
			name: payload.name,
			role: payload.role as "GLOBAL_ADMIN" | "TENANT_ADMIN" | "STAFF",
			tenantId: payload.tenantId as string | undefined,
			sessionId: payload.sessionId,
			iat: payload.iat,
			exp: payload.exp
		};
	} catch (error) {
		logger.warn("JWT verification failed:", { error: String(error) });
		return null;
	}
}

export async function verifyRefreshToken(
	token: string
): Promise<{ userId: string; sessionId: string } | null> {
	try {
		const { payload } = await jwtVerify(token, JWT_SECRET);

		if (
			typeof payload.userId === "string" &&
			typeof payload.sessionId === "string" &&
			payload.type === "refresh"
		) {
			return {
				userId: payload.userId,
				sessionId: payload.sessionId
			};
		}

		logger.warn("Invalid refresh token payload");
		return null;
	} catch (error) {
		logger.warn("Refresh token verification failed:", { error: String(error) });
		return null;
	}
}

export async function generateTokens(user: SelectUser, sessionId: string): Promise<JWTTokens> {
	const [accessToken, refreshToken] = await Promise.all([
		generateAccessToken(user, sessionId),
		generateRefreshToken(user.id, sessionId)
	]);

	return {
		accessToken,
		refreshToken
	};
}

export async function isTokenExpired(token: string): Promise<boolean> {
	try {
		await jwtVerify(token, JWT_SECRET);
		return false;
	} catch {
		return true;
	}
}
