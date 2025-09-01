import { eq, and, gt, lt } from "drizzle-orm";
import { db } from "$lib/server/db";
import { user, userSession } from "$lib/server/db/central-schema";
import type {
	SelectUser,
	InsertUserSession,
	SelectUserSession
} from "$lib/server/db/central-schema";
import { generateTokens, verifyRefreshToken, verifyAccessToken } from "./jwt-utils";
import { UniversalLogger } from "$lib/logger";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";

const logger = new UniversalLogger().setContext("AuthService");

export interface SessionData {
	sessionToken: string;
	accessToken: string;
	refreshToken: string;
	user: SelectUser;
	expiresAt: Date;
}

export interface LoginResult {
	sessionToken: string;
	accessToken: string;
	refreshToken: string;
	user: SelectUser;
	expiresAt: Date;
}

export interface RefreshResult {
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
}

export class SessionService {
	private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

	static async createSession(
		userId: string,
		ipAddress?: string,
		userAgent?: string
	): Promise<SessionData> {
		logger.info(`Creating session for user: ${userId}`);

		const existingUser = await db.select().from(user).where(eq(user.id, userId)).limit(1);

		if (existingUser.length === 0) {
			throw new NotFoundError(`User with ID ${userId} not found`);
		}

		const userData = existingUser[0];

		if (!userData.isActive) {
			throw new ValidationError("User account is inactive");
		}

		if (!userData.confirmed) {
			throw new ValidationError("User account is not confirmed");
		}

		// Create session entry first to get the ID
		const sessionData: InsertUserSession = {
			userId: userData.id,
			sessionToken: "", // Will be updated with actual token
			accessToken: "", // Will be updated with actual token
			refreshToken: "", // Will be updated with actual token
			ipAddress,
			userAgent,
			expiresAt: new Date(Date.now() + this.SESSION_DURATION),
			lastUsedAt: new Date()
		};

		const [createdSession] = await db.insert(userSession).values(sessionData).returning();

		// Generate tokens with the actual session ID
		const tokens = await generateTokens(userData, createdSession.id);

		// Update session with actual tokens
		const [updatedSession] = await db
			.update(userSession)
			.set({
				sessionToken: tokens.accessToken, // Use access token as session token
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken
			})
			.where(eq(userSession.id, createdSession.id))
			.returning();

		await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, userId));

		logger.info(`Session created successfully for user: ${userId}`);

		return {
			sessionToken: updatedSession.sessionToken,
			accessToken: updatedSession.accessToken,
			refreshToken: updatedSession.refreshToken,
			user: userData,
			expiresAt: updatedSession.expiresAt
		};
	}

	/**
	 * Validates an access token by checking if it exists in the database and is not expired
	 */
	static async validateTokenWithDB(
		accessToken: string
	): Promise<{ user: SelectUser; sessionId: string; exp: Date } | null> {
		logger.debug("Validating access token with database");

		try {
			// First verify the JWT token structure
			const tokenData = await verifyAccessToken(accessToken);
			if (!tokenData) {
				logger.debug("Access token is invalid or expired");
				return null;
			}

			// Check if session exists in database and is not expired
			const sessions = await db
				.select()
				.from(userSession)
				.innerJoin(user, eq(userSession.userId, user.id))
				.where(
					and(
						eq(userSession.id, tokenData.sessionId),
						eq(userSession.accessToken, accessToken),
						gt(userSession.expiresAt, new Date())
					)
				)
				.limit(1);

			if (sessions.length === 0) {
				logger.debug("Session not found in database or expired");
				return null;
			}

			const session = sessions[0];

			if (!session.user.isActive) {
				logger.debug("User account is inactive");
				return null;
			}

			if (!session.user.confirmed) {
				logger.debug("User account is not confirmed");
				return null;
			}

			// Update last used time
			await db
				.update(userSession)
				.set({ lastUsedAt: new Date() })
				.where(eq(userSession.id, session.user_session.id));

			logger.debug("Access token validated successfully");

			return {
				user: session.user,
				exp: session.user_session.expiresAt,
				sessionId: session.user_session.id
			};
		} catch (error) {
			logger.error("Error validating token with database:", { error: String(error) });
			return null;
		}
	}

	static async validateSession(sessionToken: string): Promise<SessionData | null> {
		logger.debug(`Validating session: ${sessionToken}`);

		const sessions = await db
			.select()
			.from(userSession)
			.innerJoin(user, eq(userSession.userId, user.id))
			.where(and(eq(userSession.sessionToken, sessionToken), gt(userSession.expiresAt, new Date())))
			.limit(1);

		if (sessions.length === 0) {
			logger.warn(`Session not found or expired: ${sessionToken}`);
			return null;
		}

		const session = sessions[0];

		if (!session.user.isActive) {
			logger.warn(`User account inactive for session: ${sessionToken}`);
			return null;
		}

		await db
			.update(userSession)
			.set({ lastUsedAt: new Date() })
			.where(eq(userSession.id, session.user_session.id));

		logger.debug(`Session validated successfully: ${sessionToken}`);

		return {
			sessionToken: session.user_session.sessionToken,
			accessToken: session.user_session.accessToken,
			refreshToken: session.user_session.refreshToken,
			user: session.user,
			expiresAt: session.user_session.expiresAt
		};
	}

	static async refreshSession(refreshToken: string): Promise<RefreshResult | null> {
		logger.debug("Refreshing session tokens");

		const tokenData = await verifyRefreshToken(refreshToken);
		if (!tokenData) {
			logger.warn("Invalid refresh token");
			return null;
		}

		const sessions = await db
			.select()
			.from(userSession)
			.innerJoin(user, eq(userSession.userId, user.id))
			.where(
				and(
					eq(userSession.id, tokenData.sessionId),
					eq(userSession.refreshToken, refreshToken),
					gt(userSession.expiresAt, new Date())
				)
			)
			.limit(1);

		if (sessions.length === 0) {
			logger.warn("Session not found for refresh token");
			return null;
		}

		const session = sessions[0];

		if (!session.user.isActive) {
			logger.warn("User account inactive for refresh");
			return null;
		}

		const newTokens = await generateTokens(session.user, session.user_session.id);
		const newExpiresAt = new Date(Date.now() + this.SESSION_DURATION);

		await db
			.update(userSession)
			.set({
				accessToken: newTokens.accessToken,
				refreshToken: newTokens.refreshToken,
				expiresAt: newExpiresAt,
				lastUsedAt: new Date()
			})
			.where(eq(userSession.id, session.user_session.id));

		logger.info("Session tokens refreshed successfully");

		return {
			accessToken: newTokens.accessToken,
			refreshToken: newTokens.refreshToken,
			expiresAt: newExpiresAt
		};
	}

	static async logout(sessionToken: string): Promise<void> {
		logger.info(`Logging out session: ${sessionToken}`);

		await db.delete(userSession).where(eq(userSession.sessionToken, sessionToken));

		logger.info(`Session logged out successfully: ${sessionToken}`);
	}

	static async logoutAllSessions(userId: string): Promise<void> {
		logger.info(`Logging out all sessions for user: ${userId}`);

		await db.delete(userSession).where(eq(userSession.userId, userId));

		logger.info(`All sessions logged out for user: ${userId}`);
	}

	static async cleanupExpiredSessions(): Promise<void> {
		logger.info("Cleaning up expired sessions");

		await db.delete(userSession).where(lt(userSession.expiresAt, new Date()));

		logger.info("Expired sessions cleaned up");
	}

	static async getActiveSessions(userId: string): Promise<SelectUserSession[]> {
		logger.debug(`Getting active sessions for user: ${userId}`);

		const sessions = await db
			.select()
			.from(userSession)
			.where(and(eq(userSession.userId, userId), gt(userSession.expiresAt, new Date())))
			.orderBy(userSession.lastUsedAt);

		return sessions;
	}

	static async getUserFromSession(sessionToken: string): Promise<SelectUser | null> {
		const sessionData = await this.validateSession(sessionToken);
		return sessionData ? sessionData.user : null;
	}

	static async revokeSession(sessionId: string): Promise<void> {
		logger.info(`Revoking session: ${sessionId}`);

		await db.delete(userSession).where(eq(userSession.id, sessionId));

		logger.info(`Session revoked: ${sessionId}`);
	}
}
