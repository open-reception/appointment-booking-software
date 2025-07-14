import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./+server";

// Mock dependencies
vi.mock("$lib/server/services/admin-account-service", () => ({
	AdminAccountService: {
		adminExists: vi.fn(),
		getAdminCount: vi.fn()
	}
}));

vi.mock("$lib/logger", () => ({
	default: {
		setContext: vi.fn(() => ({
			debug: vi.fn(),
			error: vi.fn()
		}))
	}
}));

// Import after mocking
import { AdminAccountService } from "$lib/server/services/admin-account-service";

describe("GET /api/admin/exists", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return admin exists status when admin exists", async () => {
		vi.mocked(AdminAccountService.adminExists).mockResolvedValue(true);
		vi.mocked(AdminAccountService.getAdminCount).mockResolvedValue(2);

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({
			exists: true,
			count: 2
		});
		expect(AdminAccountService.adminExists).toHaveBeenCalledOnce();
		expect(AdminAccountService.getAdminCount).toHaveBeenCalledOnce();
	});

	it("should return admin does not exist when no admin found", async () => {
		vi.mocked(AdminAccountService.adminExists).mockResolvedValue(false);
		vi.mocked(AdminAccountService.getAdminCount).mockResolvedValue(0);

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({
			exists: false,
			count: 0
		});
		expect(AdminAccountService.adminExists).toHaveBeenCalledOnce();
		expect(AdminAccountService.getAdminCount).toHaveBeenCalledOnce();
	});

	it("should handle service errors", async () => {
		vi.mocked(AdminAccountService.adminExists).mockRejectedValue(new Error("Database error"));

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({
			error: "Internal server error"
		});
		expect(AdminAccountService.adminExists).toHaveBeenCalledOnce();
		expect(AdminAccountService.getAdminCount).not.toHaveBeenCalled();
	});

	it("should handle getAdminCount error", async () => {
		vi.mocked(AdminAccountService.adminExists).mockResolvedValue(true);
		vi.mocked(AdminAccountService.getAdminCount).mockRejectedValue(new Error("Count error"));

		const response = await GET();
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({
			error: "Internal server error"
		});
		expect(AdminAccountService.adminExists).toHaveBeenCalledOnce();
		expect(AdminAccountService.getAdminCount).toHaveBeenCalledOnce();
	});
});