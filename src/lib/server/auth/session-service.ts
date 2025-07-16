import { eq, and, gt, lt } from "drizzle-orm";
import { centralDb } from "$lib/server/db";
import { user, userSession } from "$lib/server/db/central-schema";
import type {
	SelectUser,
	InsertUserSession,
	SelectUserSession
} from "$lib/server/db/central-schema";
import { generateTokens, verifyRefreshToken, isTokenExpired } from "./jwt-utils";
import { UniversalLogger } from "$lib/logger";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { uuidv7 } from "uuidv7";

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

		const existingUser = await centralDb.select().from(user).where(eq(user.id, userId)).limit(1);

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

		const sessionId = uuidv7();
		const sessionToken = uuidv7();
		const expiresAt = new Date(Date.now() + this.SESSION_DURATION);

		const tokens = await generateTokens(userData, sessionId);

		const sessionData: InsertUserSession = {
			id: sessionId,
			userId: userData.id,
			sessionToken,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			ipAddress,
			userAgent,
			expiresAt,
			lastUsedAt: new Date()
		};

		await centralDb.insert(userSession).values(sessionData);

		await centralDb.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, userId));

		logger.info(`Session created successfully for user: ${userId}`);

		return {
			sessionToken,
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			user: userData,
			expiresAt
		};
	}

	static async validateSession(sessionToken: string): Promise<SessionData | null> {
		logger.debug(`Validating session: ${sessionToken}`);

		const sessions = await centralDb
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

		if (await isTokenExpired(session.user_session.accessToken)) {
			logger.debug(`Access token expired for session: ${sessionToken}`);
			return null;
		}

		await centralDb
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

		const sessions = await centralDb
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

		await centralDb
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

		await centralDb.delete(userSession).where(eq(userSession.sessionToken, sessionToken));

		logger.info(`Session logged out successfully: ${sessionToken}`);
	}

	static async logoutAllSessions(userId: string): Promise<void> {
		logger.info(`Logging out all sessions for user: ${userId}`);

		await centralDb.delete(userSession).where(eq(userSession.userId, userId));

		logger.info(`All sessions logged out for user: ${userId}`);
	}

	static async cleanupExpiredSessions(): Promise<void> {
		logger.info("Cleaning up expired sessions");

		await centralDb.delete(userSession).where(lt(userSession.expiresAt, new Date()));

		logger.info("Expired sessions cleaned up");
	}

	static async getActiveSessions(userId: string): Promise<SelectUserSession[]> {
		logger.debug(`Getting active sessions for user: ${userId}`);

		const sessions = await centralDb
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

		await centralDb.delete(userSession).where(eq(userSession.id, sessionId));

		logger.info(`Session revoked: ${sessionId}`);
	}
}
