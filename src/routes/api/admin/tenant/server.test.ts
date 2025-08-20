/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock SvelteKit's error function
vi.mock("@sveltejs/kit", async () => {
	const actual = await vi.importActual("@sveltejs/kit");
	return {
		...actual,
		error: vi.fn((status: number, message: string) => {
			const error = new Error(message);
			(error as any).status = status;
			(error as any).body = { message };
			throw error;
		}),
		json: vi.fn((data: any) => {
			return new Response(JSON.stringify(data), { status: 200 });
		})
	};
});

// Mock the auth service
vi.mock("$lib/server/auth/auth-service", () => ({
	AuthService: {
		validateSession: vi.fn(),
		refreshSession: vi.fn()
	}
}));

// Mock the session service
vi.mock("$lib/server/auth/session-service", () => ({
	SessionService: {
		validateSession: vi.fn(),
		refreshSession: vi.fn()
	}
}));

// Mock the database
vi.mock("$lib/server/db", () => ({
	centralDb: {
		select: vi.fn(),
		update: vi.fn()
	}
}));

// Mock the user service
vi.mock("$lib/server/services/user-service", () => ({
	UserService: {
		updateUser: vi.fn()
	}
}));

// Mock JWT utils
vi.mock("$lib/server/auth/jwt-utils", () => ({
	generateAccessToken: vi.fn()
}));

// Mock universal logger
vi.mock("$lib/logger", () => ({
	UniversalLogger: vi.fn(() => ({
		setContext: vi.fn().mockReturnThis(),
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn()
	}))
}));

// Mock openapi
vi.mock("$lib/server/openapi", () => ({
	registerOpenAPIRoute: vi.fn()
}));

// Mock database schemas
vi.mock("$lib/server/db/central-schema", () => ({
	tenant: { id: "tenant.id" },
	user: { id: "user.id" },
	userSession: { id: "userSession.id", sessionToken: "userSession.sessionToken" }
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
	eq: vi.fn(() => "eq-condition")
}));

// Mock error classes
vi.mock("$lib/server/utils/errors", () => ({
	ValidationError: class ValidationError extends Error {},
	NotFoundError: class NotFoundError extends Error {}
}));

// Mock permissions module  
vi.mock("$lib/server/utils/permissions", () => ({
	checkPermission: vi.fn()
}));

import { centralDb } from "$lib/server/db";
import { UserService } from "$lib/server/services/user-service";
import { generateAccessToken } from "$lib/server/auth/jwt-utils";
import { checkPermission } from "$lib/server/utils/permissions";

describe("POST /api/admin/tenant", () => {
	const mockUser = {
		id: "user-123",
		email: "admin@example.com",
		name: "Admin User",
		role: "GLOBAL_ADMIN" as const,
		tenantId: null,
		confirmed: true,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		lastLoginAt: null,
		token: null,
		tokenValidUntil: null,
		passphraseHash: null,
		recoveryPassphrase: null
	};

	const mockCookies = {
		get: vi.fn(),
		set: vi.fn(),
		getAll: vi.fn(),
		delete: vi.fn(),
		serialize: vi.fn()
	};

	const createRequestEvent = (body: any, user: any = mockUser): RequestEvent => ({
		request: {
			json: () => Promise.resolve(body)
		} as Request,
		locals: { user: user ? { ...user, sessionId: "session-123" } : null },
		cookies: mockCookies,
		params: {},
		url: new URL("http://localhost/api/admin/tenant"),
		route: { id: "/api/admin/tenant" },
		platform: undefined,
		getClientAddress: () => "127.0.0.1",
		isDataRequest: false,
		isSubRequest: false,
		fetch: fetch,
		setHeaders: vi.fn()
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should successfully switch to a tenant", async () => {
		const tenantId = "550e8400-e29b-41d4-a716-446655440000";
		const requestEvent = createRequestEvent({ tenantId });

		// Mock permission check to pass
		vi.mocked(checkPermission).mockReturnValue(null);

		// Mock tenant exists query
		const mockSelectQuery = {
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([{ id: tenantId }])
		};
		vi.mocked(centralDb.select).mockReturnValue(mockSelectQuery as any);

		// No session handling needed anymore

		// Mock user update
		const updatedUser = { ...mockUser, tenantId };
		vi.mocked(UserService.updateUser).mockResolvedValue(updatedUser as any);

		// Mock token generation
		vi.mocked(generateAccessToken).mockResolvedValue("new-access-123");

		// Mock database update queries
		const mockUpdateQuery = {
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockResolvedValue({ count: 1 })
		};
		vi.mocked(centralDb.update).mockReturnValue(mockUpdateQuery as any);

		const response = await POST(requestEvent);
		const result = await response.json();

		expect(response.status).toBe(200);
		expect(result.success).toBe(true);
		expect(result.tenantId).toBe(tenantId);
		expect(result.user.tenantId).toBe(tenantId);
		expect(mockCookies.set).toHaveBeenCalledWith(
			"access_token",
			"new-access-123",
			expect.any(Object)
		);
	});

	it("should return 401 when user is not authenticated", async () => {
		const requestEvent = createRequestEvent(
			{ tenantId: "550e8400-e29b-41d4-a716-446655440000" },
			null
		);

		// Mock permission check to return 401 error
		const mockErrorResponse = new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 });
		vi.mocked(checkPermission).mockReturnValue(mockErrorResponse);

		const response = await POST(requestEvent);
		expect(response.status).toBe(401);
		const result = await response.json();
		expect(result.error).toBe("Authentication required");
	});

	it("should return 403 when user is not a global admin", async () => {
		const tenantAdminUser = { ...mockUser, role: "TENANT_ADMIN" as const };
		const requestEvent = createRequestEvent(
			{ tenantId: "550e8400-e29b-41d4-a716-446655440000" },
			tenantAdminUser
		);

		// Mock permission check to return 403 error
		const mockErrorResponse = new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403 });
		vi.mocked(checkPermission).mockReturnValue(mockErrorResponse);

		const response = await POST(requestEvent);
		expect(response.status).toBe(403);
		const result = await response.json();
		expect(result.error).toBe("Insufficient permissions");
	});

	it("should return 400 when request body is invalid", async () => {
		const requestEvent = createRequestEvent({ tenantId: "invalid-uuid" });

		// Mock permission check to pass
		vi.mocked(checkPermission).mockReturnValue(null);

		await expect(POST(requestEvent)).rejects.toThrow();
	});

	it("should return 404 when tenant does not exist", async () => {
		const requestEvent = createRequestEvent({ tenantId: "550e8400-e29b-41d4-a716-446655440000" });

		// Mock permission check to pass
		vi.mocked(checkPermission).mockReturnValue(null);

		// Mock tenant doesn't exist
		const mockSelectQuery = {
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([])
		};
		vi.mocked(centralDb.select).mockReturnValue(mockSelectQuery as any);

		await expect(POST(requestEvent)).rejects.toThrow();
	});
});
