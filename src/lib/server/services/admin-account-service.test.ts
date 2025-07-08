import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotFoundError } from "../utils/errors";

// Mock the database module
vi.mock("../db", () => ({
	centralDb: {
		insert: vi.fn(),
		select: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	}
}));

// Mock the logger
vi.mock("$lib/logger", () => ({
	default: {
		setContext: vi.fn().mockReturnValue({
			debug: vi.fn(),
			warn: vi.fn(),
			error: vi.fn()
		})
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

// Mock zod
vi.mock("zod/v4", () => ({
	default: {
		object: vi.fn().mockReturnValue({
			safeParse: vi.fn().mockReturnValue({ success: true })
		}),
		string: vi.fn().mockReturnValue({
			min: vi.fn().mockReturnThis(),
			email: vi.fn().mockReturnThis()
		}),
		uuidv7: vi.fn().mockReturnValue({
			optional: vi.fn().mockReturnThis()
		}),
		date: vi.fn().mockReturnValue({
			optional: vi.fn().mockReturnThis()
		})
	}
}));

describe("AdminAccountService", () => {
	let AdminAccountService: any;
	let mockCentralDb: any;
	let mockUuidv7: any;
	let mockAddMinutes: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Import the service after mocks are set up
		AdminAccountService = (await import("./admin-account-service")).AdminAccountService;

		// Get mocked modules
		const dbModule = await vi.importMock("../db");
		mockCentralDb = dbModule.centralDb;

		const uuidModule = await vi.importMock("uuidv7");
		mockUuidv7 = uuidModule.uuidv7;

		const dateFnsModule = await vi.importMock("date-fns");
		mockAddMinutes = dateFnsModule.addMinutes;

		// Setup default mock returns
		mockUuidv7.mockReturnValue("test-uuid-123");
		const futureDate = new Date("2024-01-01T12:10:00Z");
		mockAddMinutes.mockReturnValue(futureDate);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("createAdmin", () => {
		it("should create a new admin with valid data", async () => {
			const adminData = {
				name: "Test Admin",
				email: "test@example.com"
			};

			const mockCreatedAdmin = {
				id: "admin-123",
				name: "Test Admin",
				email: "test@example.com",
				token: "test-uuid-123",
				tokenValidUntil: new Date("2024-01-01T12:10:00Z"),
				confirmed: false,
				isActive: false
			};

			const mockInsertBuilder = {
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockCreatedAdmin])
			};

			mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

			const result = await AdminAccountService.createAdmin(adminData);

			expect(mockCentralDb.insert).toHaveBeenCalled();
			expect(mockInsertBuilder.values).toHaveBeenCalledWith({
				...adminData,
				token: "test-uuid-123",
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

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				execute: vi.fn().mockResolvedValue({ count: 1 })
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			await AdminAccountService.resendConfirmationEmail(email);

			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				token: "test-uuid-123",
				tokenValidUntil: expect.any(Date)
			});
		});

		it("should throw NotFoundError for non-existent admin", async () => {
			const email = "nonexistent@example.com";

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				execute: vi.fn().mockResolvedValue({ count: 0 })
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			await expect(AdminAccountService.resendConfirmationEmail(email)).rejects.toThrow(
				NotFoundError
			);
		});
	});

	describe("confirm", () => {
		it("should confirm admin with valid token", async () => {
			const token = "valid-token-123";

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				execute: vi.fn().mockResolvedValue({ count: 1 })
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			await AdminAccountService.confirm(token);

			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				confirmed: true,
				isActive: true
			});
		});

		it("should throw NotFoundError for invalid token", async () => {
			const token = "invalid-token";

			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				execute: vi.fn().mockResolvedValue({ count: 0 })
			};

			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			await expect(AdminAccountService.confirm(token)).rejects.toThrow(NotFoundError);
		});
	});

	describe("getAdminByEmail", () => {
		it("should return admin for existing email", async () => {
			const email = "test@example.com";
			const mockAdmin = {
				id: "admin-123",
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

			const result = await AdminAccountService.getAdminByEmail(email);

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

			await expect(AdminAccountService.getAdminByEmail(email)).rejects.toThrow(NotFoundError);
		});
	});

	describe("updateAdmin", () => {
		it("should update admin successfully", async () => {
			const adminId = "admin-123";
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

			const result = await AdminAccountService.updateAdmin(adminId, updateData);

			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
				...updateData,
				updatedAt: expect.any(Date)
			});
			expect(result).toEqual(mockUpdatedAdmin);
		});
	});

	describe("deleteAdmin", () => {
		it("should delete admin and associated passkeys", async () => {
			const adminId = "admin-123";
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

			const result = await AdminAccountService.deleteAdmin(adminId);

			expect(mockCentralDb.delete).toHaveBeenCalledTimes(2);
			expect(result).toEqual(mockDeletedAdmin);
		});
	});

	describe("addPasskey", () => {
		it("should add passkey for admin", async () => {
			const adminId = "admin-123";
			const passkeyData = {
				id: "passkey-123",
				publicKey: "public-key-data",
				counter: 0,
				deviceName: "Test Device"
			};

			const mockCreatedPasskey = {
				...passkeyData,
				adminId,
				createdAt: new Date(),
				updatedAt: new Date()
			};

			const mockInsertBuilder = {
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockCreatedPasskey])
			};

			mockCentralDb.insert.mockReturnValue(mockInsertBuilder);

			const result = await AdminAccountService.addPasskey(adminId, passkeyData);

			expect(mockCentralDb.insert).toHaveBeenCalled();
			expect(mockInsertBuilder.values).toHaveBeenCalledWith({
				...passkeyData,
				adminId
			});
			expect(result).toEqual(mockCreatedPasskey);
		});
	});
});
