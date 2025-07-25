/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotFoundError } from "../../utils/errors";

// Mock the database module
vi.mock("../../db", () => ({
	centralDb: {
		insert: vi.fn(),
		select: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	}
}));

// Mock the email service
vi.mock("../../email/email-service", () => ({
	sendConfirmationEmail: vi.fn()
}));

// Mock the tenant admin service
vi.mock("../tenant-admin-service", () => ({
	TenantAdminService: {
		getTenantById: vi.fn()
	}
}));

// Mock uuid generation
vi.mock("uuidv7", () => ({
	uuidv7: vi.fn()
}));

// Mock date-fns
vi.mock("date-fns", () => ({
	addMinutes: vi.fn()
}));

// Import the service after mocks are set up
import { UserService } from "../user-service";

describe("UserService", () => {
	let mockCentralDb: any;
	let mockUuidv7: any;
	let mockAddMinutes: any;
	let mockSendConfirmationEmail: any;
	let mockTenantAdminService: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Get mocked modules
		const dbModule = await vi.importMock("../../db");
		mockCentralDb = dbModule.centralDb;

		const uuidModule = await vi.importMock("uuidv7");
		mockUuidv7 = uuidModule.uuidv7;

		const dateFnsModule = await vi.importMock("date-fns");
		mockAddMinutes = dateFnsModule.addMinutes;

		const emailModule = await vi.importMock("../../email/email-service");
		mockSendConfirmationEmail = emailModule.sendConfirmationEmail;

		const tenantModule = await vi.importMock("../tenant-admin-service");
		mockTenantAdminService = tenantModule.TenantAdminService;

		// Setup default mock returns
		mockUuidv7.mockReturnValue("018f-a1b2-c3d4-e5f6-789abcdef012");
		const futureDate = new Date("2024-01-01T12:10:00Z");
		mockAddMinutes.mockReturnValue(futureDate);
		mockSendConfirmationEmail.mockResolvedValue(undefined);
		mockTenantAdminService.getTenantById.mockResolvedValue({
			tenantData: {
				id: "tenant-123",
				shortName: "test",
				longName: "Test Tenant"
			}
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("createUser", () => {
		it("should create a new admin with valid data", async () => {
			const adminData = {
				name: "Test Admin",
				email: "test@example.com",
				language: "de" as const
			};

			const mockCreatedAdmin = {
				id: "018f-a1b2-c3d4-e5f6-789abcdef012",
				name: "Test Admin",
				email: "test@example.com",
				token: "018f-a1b2-c3d4-e5f6-789abcdef012",
				tokenValidUntil: new Date("2024-01-01T12:10:00Z"),
				confirmed: false,
				isActive: false
			};

			const mockInsertBuilder = {
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockCreatedAdmin])
			};

			mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

			const result = await UserService.createUser(adminData);

			expect(mockCentralDb.insert).toHaveBeenCalled();
			expect(mockInsertBuilder.values).toHaveBeenCalledWith({
				...adminData,
				token: "018f-a1b2-c3d4-e5f6-789abcdef012",
				tokenValidUntil: expect.any(Date),
				confirmed: false,
				isActive: false
			});
			expect(result).toEqual(mockCreatedAdmin);
		});
	});

	describe("resendConfirmationEmail", () => {
		it("should resend confirmation email for existing admin", async () => {
			const email = "test@example.com";

			const mockUser = {
				id: "user-123",
				email: "test@example.com",
				name: "Test User",
				tenantId: null
			};

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockUser])
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			await UserService.resendConfirmationEmail(email);

			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				token: "018f-a1b2-c3d4-e5f6-789abcdef012",
				tokenValidUntil: expect.any(Date)
			});
			expect(mockUpdateBuilder.where).toHaveBeenCalled();
			expect(mockUpdateBuilder.returning).toHaveBeenCalled();
		});

		it("should throw NotFoundError for non-existent admin", async () => {
			const email = "nonexistent@example.com";

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([])
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			await expect(UserService.resendConfirmationEmail(email)).rejects.toThrow(NotFoundError);
		});
	});

	describe("confirm", () => {
		it("should confirm admin with valid token", async () => {
			const token = "018f-a1b2-c3d4-e5f6-789abcdef012";

			const mockSelectBuilder = {
				select: vi.fn().mockReturnThis(),
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				limit: vi.fn().mockResolvedValue([{ id: "user-123", recoveryPassphrase: "recovery-123" }])
			};

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				execute: vi.fn().mockResolvedValue({ count: 1 })
			};

			mockCentralDb.select.mockReturnValue(mockSelectBuilder);
			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			const result = await UserService.confirm(token);

			expect(mockCentralDb.select).toHaveBeenCalled();
			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				confirmed: true,
				isActive: true,
				recoveryPassphrase: null
			});
			expect(result.recoveryPassphrase).toBe("recovery-123");
		});

		it("should throw NotFoundError for invalid token", async () => {
			const token = "018f-0000-0000-0000-000000000000";

			const mockSelectBuilder = {
				select: vi.fn().mockReturnThis(),
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				limit: vi.fn().mockResolvedValue([]) // Empty array for no user found
			};

			mockCentralDb.select.mockReturnValue(mockSelectBuilder);

			await expect(UserService.confirm(token)).rejects.toThrow(NotFoundError);
		});
	});

	describe("getUserByEmail", () => {
		it("should return admin for existing email", async () => {
			const email = "test@example.com";
			const mockAdmin = {
				id: "018f-a1b2-c3d4-e5f6-789abcdef012",
				name: "Test Admin",
				email: "test@example.com",
				confirmed: true,
				isActive: true
			};

			const mockSelectBuilder = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				limit: vi.fn().mockResolvedValue([mockAdmin])
			};

			mockCentralDb.select.mockReturnValue(mockSelectBuilder);

			const result = await UserService.getUserByEmail(email);

			expect(mockCentralDb.select).toHaveBeenCalled();
			expect(mockSelectBuilder.from).toHaveBeenCalled();
			expect(mockSelectBuilder.where).toHaveBeenCalled();
			expect(mockSelectBuilder.limit).toHaveBeenCalledWith(1);
			expect(result).toEqual(mockAdmin);
		});

		it("should throw NotFoundError for non-existent email", async () => {
			const email = "nonexistent@example.com";

			const mockSelectBuilder = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				limit: vi.fn().mockResolvedValue([])
			};

			mockCentralDb.select.mockReturnValue(mockSelectBuilder);

			await expect(UserService.getUserByEmail(email)).rejects.toThrow(NotFoundError);
		});
	});

	describe("updateUser", () => {
		it("should update admin successfully", async () => {
			const adminId = "018f-a1b2-c3d4-e5f6-789abcdef012";
			const updateData = { name: "Updated Admin" };
			const mockUpdatedAdmin = {
				id: adminId,
				name: "Updated Admin",
				email: "test@example.com",
				updatedAt: new Date()
			};

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockUpdatedAdmin])
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			const result = await UserService.updateUser(adminId, updateData);

			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				...updateData,
				updatedAt: expect.any(Date)
			});
			expect(result).toEqual(mockUpdatedAdmin);
		});
	});

	describe("deleteUser", () => {
		it("should delete admin and associated passkeys", async () => {
			const adminId = "018f-a1b2-c3d4-e5f6-789abcdef012";
			const mockDeletedAdmin = {
				id: adminId,
				name: "Deleted Admin",
				email: "deleted@example.com"
			};

			const mockDeleteBuilder = {
				where: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockDeletedAdmin])
			};

			mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);

			const result = await UserService.deleteUser(adminId);

			expect(mockCentralDb.delete).toHaveBeenCalledTimes(2);
			expect(result).toEqual(mockDeletedAdmin);
		});
	});

	describe("addPasskey", () => {
		it("should add passkey for admin", async () => {
			const adminId = "018f-a1b2-c3d4-e5f6-789abcdef012";
			const passkeyData = {
				id: "018f-b2c3-d4e5-f6a7-89abcdef0123",
				publicKey: "public-key-data",
				counter: 0,
				deviceName: "Test Device"
			};

			const mockCreatedPasskey = {
				...passkeyData,
				userId: adminId,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const mockInsertBuilder = {
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockCreatedPasskey])
			};

			mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

			const result = await UserService.addPasskey(adminId, passkeyData);

			expect(mockCentralDb.insert).toHaveBeenCalled();
			expect(mockInsertBuilder.values).toHaveBeenCalledWith({
				...passkeyData,
				userId: adminId
			});
			expect(result).toEqual(mockCreatedPasskey);
		});
	});
});
