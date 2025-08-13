/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, NotFoundError, ConflictError } from "../../utils/errors";

// Mock dependencies before imports
vi.mock("../../db", () => ({
	getTenantDb: vi.fn()
}));

vi.mock("$lib/logger", () => ({
	default: {
		setContext: vi.fn(() => ({
			debug: vi.fn(),
			error: vi.fn(),
			warn: vi.fn()
		}))
	}
}));

// Import after mocking
import { AppointmentService, type AppointmentCreationRequest } from "../appointment-service";
import { getTenantDb } from "../../db";

// Mock database operations
const mockDb = {
	insert: vi.fn(() => ({
		values: vi.fn(() => ({
			returning: vi.fn()
		}))
	})),
	select: vi.fn(() => ({
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn()
			})),
			leftJoin: vi.fn(() => ({
				leftJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn()
					}))
				})),
				where: vi.fn(() => ({
					orderBy: vi.fn()
				}))
			})),
			orderBy: vi.fn()
		}))
	})),
	update: vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn()
			}))
		}))
	})),
	delete: vi.fn(() => ({
		where: vi.fn(() => ({
			returning: vi.fn()
		}))
	}))
};

describe("AppointmentService", () => {
	const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";

	beforeEach(() => {
		vi.clearAllMocks();
		(getTenantDb as any).mockResolvedValue(mockDb);
	});

	describe("forTenant", () => {
		it("should create an appointment service instance", async () => {
			const service = await AppointmentService.forTenant(mockTenantId);

			expect(service).toBeInstanceOf(AppointmentService);
			expect(service.tenantId).toBe(mockTenantId);
			expect(getTenantDb).toHaveBeenCalledWith(mockTenantId);
		});

		it("should throw error if database connection fails", async () => {
			(getTenantDb as any).mockRejectedValue(new Error("Database connection failed"));

			await expect(AppointmentService.forTenant(mockTenantId)).rejects.toThrow(
				"Database connection failed"
			);
		});
	});

	describe("createAppointment", () => {
		let service: AppointmentService;

		beforeEach(async () => {
			service = await AppointmentService.forTenant(mockTenantId);
		});

		it("should validate appointment creation request", async () => {
			const invalidRequest = {
				clientId: "invalid-uuid",
				channelId: "123e4567-e89b-12d3-a456-426614174001",
				appointmentDate: "invalid-date",
				expiryDate: "2024-01-02",
				title: ""
			};

			await expect(
				service.createAppointment(invalidRequest as AppointmentCreationRequest)
			).rejects.toThrow(ValidationError);
		});

		it("should create appointment successfully", async () => {
			const validRequest: AppointmentCreationRequest = {
				clientId: "123e4567-e89b-12d3-a456-426614174001",
				channelId: "123e4567-e89b-12d3-a456-426614174002",
				appointmentDate: "2024-01-01T10:00:00.000Z",
				expiryDate: "2024-01-31",
				title: "Test Appointment",
				description: "Test Description",
				status: "NEW"
			};

			// Mock database responses
			const mockClient = [
				{
					id: validRequest.clientId,
					hashKey: "test",
					publicKey: "test",
					privateKeyShare: "test",
					email: "test@test.com",
					language: "de"
				}
			];
			const mockChannel = [
				{
					id: validRequest.channelId,
					names: ["Test Channel"],
					pause: false,
					descriptions: ["Test"],
					languages: ["de"],
					isPublic: true,
					requiresConfirmation: false,
					color: null
				}
			];
			const mockConflictingAppointments: any[] = [];
			const mockCreatedAppointment = {
				id: "appointment-id",
				...validRequest,
				status: "NEW"
			};

			let selectCallCount = 0;
			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					where: () => ({
						limit: () => {
							selectCallCount++;
							switch (selectCallCount) {
								case 1:
									return mockClient;
								case 2:
									return mockChannel;
								case 3:
									return mockConflictingAppointments;
								default:
									return [];
							}
						}
					})
				})
			}));

			(mockDb.insert as any).mockImplementation(() => ({
				values: () => ({
					returning: () => [mockCreatedAppointment]
				})
			}));

			const result = await service.createAppointment(validRequest);

			expect(result).toEqual(mockCreatedAppointment);
		});

		it("should throw NotFoundError if client does not exist", async () => {
			const validRequest: AppointmentCreationRequest = {
				clientId: "123e4567-e89b-12d3-a456-426614174099", // Valid UUID format
				channelId: "123e4567-e89b-12d3-a456-426614174002",
				appointmentDate: "2024-01-01T10:00:00.000Z",
				expiryDate: "2024-01-31",
				title: "Test Appointment",
				status: "NEW"
			};

			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					where: () => ({
						limit: () => [] // No client found
					})
				})
			}));

			await expect(service.createAppointment(validRequest)).rejects.toThrow(NotFoundError);
		});

		it("should throw ConflictError if channel is paused", async () => {
			const validRequest: AppointmentCreationRequest = {
				clientId: "123e4567-e89b-12d3-a456-426614174001",
				channelId: "123e4567-e89b-12d3-a456-426614174002",
				appointmentDate: "2024-01-01T10:00:00.000Z",
				expiryDate: "2024-01-31",
				title: "Test Appointment",
				status: "NEW"
			};

			const mockClient = [{ id: validRequest.clientId }];
			const mockPausedChannel = [{ id: validRequest.channelId, pause: true }];

			let selectCallCount = 0;
			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					where: () => ({
						limit: () => {
							selectCallCount++;
							return selectCallCount === 1 ? mockClient : mockPausedChannel;
						}
					})
				})
			}));

			await expect(service.createAppointment(validRequest)).rejects.toThrow(ConflictError);
		});

		it("should throw ConflictError if time slot is already booked", async () => {
			const validRequest: AppointmentCreationRequest = {
				clientId: "123e4567-e89b-12d3-a456-426614174001",
				channelId: "123e4567-e89b-12d3-a456-426614174002",
				appointmentDate: "2024-01-01T10:00:00.000Z",
				expiryDate: "2024-01-31",
				title: "Test Appointment",
				status: "NEW"
			};

			const mockClient = [{ id: validRequest.clientId }];
			const mockChannel = [{ id: validRequest.channelId, pause: false }];
			const mockConflictingAppointment = [
				{ id: "existing-appointment", appointmentDate: validRequest.appointmentDate }
			];

			let selectCallCount = 0;
			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					where: () => {
						selectCallCount++;
						switch (selectCallCount) {
							case 1:
								return { limit: () => mockClient }; // client check
							case 2:
								return { limit: () => mockChannel }; // channel check
							case 3:
								return mockConflictingAppointment; // conflict check (no limit)
							default:
								return { limit: () => [] };
						}
					}
				})
			}));

			await expect(service.createAppointment(validRequest)).rejects.toThrow(ConflictError);
		});
	});

	describe("getAppointmentById", () => {
		let service: AppointmentService;

		beforeEach(async () => {
			service = await AppointmentService.forTenant(mockTenantId);
		});

		it("should return appointment with details", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const mockResult = [
				{
					appointment: {
						id: appointmentId,
						clientId: "client-id",
						channelId: "channel-id",
						appointmentDate: "2024-01-01T10:00:00.000Z",
						expiryDate: "2024-01-31",
						title: "Test Appointment",
						description: null,
						status: "NEW"
					},
					client: {
						id: "client-id",
						hashKey: "test",
						publicKey: "test",
						privateKeyShare: "test",
						email: "test@test.com",
						language: "de"
					},
					channel: {
						id: "channel-id",
						names: ["Test Channel"],
						pause: false,
						descriptions: ["Test"],
						languages: ["de"],
						isPublic: true,
						requiresConfirmation: false,
						color: null
					}
				}
			];

			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					leftJoin: () => ({
						leftJoin: () => ({
							where: () => ({
								limit: () => mockResult
							})
						})
					})
				})
			}));

			const result = await service.getAppointmentById(appointmentId);

			expect(result).toEqual({
				...mockResult[0].appointment,
				client: mockResult[0].client,
				channel: mockResult[0].channel
			});
		});

		it("should return null if appointment not found", async () => {
			const appointmentId = "non-existent";

			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					leftJoin: () => ({
						leftJoin: () => ({
							where: () => ({
								limit: () => []
							})
						})
					})
				})
			}));

			const result = await service.getAppointmentById(appointmentId);
			expect(result).toBeNull();
		});
	});

	describe("updateAppointment", () => {
		let service: AppointmentService;

		beforeEach(async () => {
			service = await AppointmentService.forTenant(mockTenantId);
		});

		it("should validate update request", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const invalidUpdate = {
				title: "", // Invalid empty title
				status: "INVALID_STATUS" as any
			};

			await expect(service.updateAppointment(appointmentId, invalidUpdate)).rejects.toThrow(
				ValidationError
			);
		});

		it("should update appointment successfully", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const updateData = {
				title: "Updated Title",
				status: "CONFIRMED" as const
			};

			const mockUpdatedAppointment = {
				id: appointmentId,
				clientId: "client-id",
				channelId: "channel-id",
				appointmentDate: "2024-01-01T10:00:00.000Z",
				expiryDate: "2024-01-31",
				title: updateData.title,
				description: null,
				status: updateData.status
			};

			(mockDb.update as any).mockImplementation(() => ({
				set: () => ({
					where: () => ({
						returning: () => [mockUpdatedAppointment]
					})
				})
			}));

			const result = await service.updateAppointment(appointmentId, updateData);
			expect(result).toEqual(mockUpdatedAppointment);
		});

		it("should throw NotFoundError if appointment does not exist", async () => {
			const appointmentId = "non-existent";
			const updateData = { title: "Updated Title" };

			(mockDb.update as any).mockImplementation(() => ({
				set: () => ({
					where: () => ({
						returning: () => [] // No rows updated
					})
				})
			}));

			await expect(service.updateAppointment(appointmentId, updateData)).rejects.toThrow(
				NotFoundError
			);
		});
	});

	describe("status update methods", () => {
		let service: AppointmentService;

		beforeEach(async () => {
			service = await AppointmentService.forTenant(mockTenantId);
		});

		it("should cancel appointment", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const mockUpdatedAppointment = {
				id: appointmentId,
				status: "REJECTED"
			};

			(mockDb.update as any).mockImplementation(() => ({
				set: () => ({
					where: () => ({
						returning: () => [mockUpdatedAppointment]
					})
				})
			}));

			const result = await service.cancelAppointment(appointmentId);
			expect(result.status).toBe("REJECTED");
		});

		it("should confirm appointment", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const mockUpdatedAppointment = {
				id: appointmentId,
				status: "CONFIRMED"
			};

			(mockDb.update as any).mockImplementation(() => ({
				set: () => ({
					where: () => ({
						returning: () => [mockUpdatedAppointment]
					})
				})
			}));

			const result = await service.confirmAppointment(appointmentId);
			expect(result.status).toBe("CONFIRMED");
		});

		it("should complete appointment", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const mockUpdatedAppointment = {
				id: appointmentId,
				status: "HELD"
			};

			(mockDb.update as any).mockImplementation(() => ({
				set: () => ({
					where: () => ({
						returning: () => [mockUpdatedAppointment]
					})
				})
			}));

			const result = await service.completeAppointment(appointmentId);
			expect(result.status).toBe("HELD");
		});

		it("should mark as no-show", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";
			const mockUpdatedAppointment = {
				id: appointmentId,
				status: "NO_SHOW"
			};

			(mockDb.update as any).mockImplementation(() => ({
				set: () => ({
					where: () => ({
						returning: () => [mockUpdatedAppointment]
					})
				})
			}));

			const result = await service.markNoShow(appointmentId);
			expect(result.status).toBe("NO_SHOW");
		});
	});

	describe("deleteAppointment", () => {
		let service: AppointmentService;

		beforeEach(async () => {
			service = await AppointmentService.forTenant(mockTenantId);
		});

		it("should delete appointment successfully", async () => {
			const appointmentId = "123e4567-e89b-12d3-a456-426614174003";

			(mockDb.delete as any).mockImplementation(() => ({
				where: () => ({
					returning: () => [{ id: appointmentId }] // Appointment was deleted
				})
			}));

			const result = await service.deleteAppointment(appointmentId);
			expect(result).toBe(true);
		});

		it("should return false if appointment not found", async () => {
			const appointmentId = "non-existent";

			(mockDb.delete as any).mockImplementation(() => ({
				where: () => ({
					returning: () => [] // No rows deleted
				})
			}));

			const result = await service.deleteAppointment(appointmentId);
			expect(result).toBe(false);
		});
	});

	describe("queryAppointments", () => {
		let service: AppointmentService;

		beforeEach(async () => {
			service = await AppointmentService.forTenant(mockTenantId);
		});

		it("should validate query request", async () => {
			const invalidQuery = {
				startDate: "invalid-date",
				endDate: "2024-01-02T00:00:00.000Z"
			};

			await expect(service.queryAppointments(invalidQuery as any)).rejects.toThrow(ValidationError);
		});

		it("should query appointments with filters", async () => {
			const validQuery = {
				startDate: "2024-01-01T00:00:00.000Z",
				endDate: "2024-01-31T23:59:59.999Z",
				channelId: "123e4567-e89b-12d3-a456-426614174002",
				status: "NEW" as const
			};

			const mockResults = [
				{
					appointment: {
						id: "appointment-id",
						clientId: "client-id",
						channelId: validQuery.channelId,
						appointmentDate: "2024-01-15T10:00:00.000Z",
						expiryDate: "2024-01-31",
						title: "Test Appointment",
						description: null,
						status: validQuery.status
					},
					client: { id: "client-id" },
					channel: { id: validQuery.channelId }
				}
			];

			(mockDb.select as any).mockImplementation(() => ({
				from: () => ({
					leftJoin: () => ({
						leftJoin: () => ({
							where: () => ({
								orderBy: () => mockResults
							})
						})
					})
				})
			}));

			const result = await service.queryAppointments(validQuery);

			expect(result).toHaveLength(1);
			expect(result[0].channelId).toBe(validQuery.channelId);
			expect(result[0].status).toBe(validQuery.status);
		});
	});
});
