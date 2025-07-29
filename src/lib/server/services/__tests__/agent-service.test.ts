/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, NotFoundError } from "../../utils/errors";

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
import { AgentService } from "../agent-service";
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
			orderBy: vi.fn(),
			innerJoin: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn()
				}))
			}))
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

const mockAgent = {
	id: "agent-123",
	name: "Test Agent",
	description: "Test description",
	logo: Buffer.from("test")
};

describe("AgentService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);
	});

	describe("forTenant", () => {
		it("should create agent service for tenant", async () => {
			const service = await AgentService.forTenant("tenant-123");

			expect(service.tenantId).toBe("tenant-123");
			expect(getTenantDb).toHaveBeenCalledWith("tenant-123");
		});

		it("should handle database connection error", async () => {
			vi.mocked(getTenantDb).mockRejectedValue(new Error("DB connection failed"));

			await expect(AgentService.forTenant("tenant-123")).rejects.toThrow("DB connection failed");
		});
	});

	describe("createAgent", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should create agent successfully", async () => {
			const insertChain = {
				values: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockAgent])
				}))
			};
			mockDb.insert.mockReturnValue(insertChain);

			const request = {
				name: "Test Agent",
				description: "Test description",
				logo: Buffer.from("test")
			};

			const result = await service.createAgent(request);

			expect(result).toEqual(mockAgent);
			expect(mockDb.insert).toHaveBeenCalled();
			expect(insertChain.values).toHaveBeenCalledWith({
				name: "Test Agent",
				description: "Test description",
				logo: Buffer.from("test")
			});
		});

		it("should handle validation error for invalid name", async () => {
			const request = {
				name: "",
				description: "Test description"
			};

			await expect(service.createAgent(request)).rejects.toThrow(ValidationError);
		});

		it("should handle database error during creation", async () => {
			const insertChain = {
				values: vi.fn(() => ({
					returning: vi.fn().mockRejectedValue(new Error("DB error"))
				}))
			};
			mockDb.insert.mockReturnValue(insertChain);

			const request = {
				name: "Test Agent"
			};

			await expect(service.createAgent(request)).rejects.toThrow("DB error");
		});
	});

	describe("getAgentById", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should return agent when found", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn().mockResolvedValue([mockAgent])
					}))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			const result = await service.getAgentById("agent-123");

			expect(result).toEqual(mockAgent);
			expect(mockDb.select).toHaveBeenCalled();
		});

		it("should return null when agent not found", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn().mockResolvedValue([])
					}))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			const result = await service.getAgentById("nonexistent-agent");

			expect(result).toBeNull();
		});

		it("should handle database error", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn().mockRejectedValue(new Error("DB error"))
					}))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			await expect(service.getAgentById("agent-123")).rejects.toThrow("DB error");
		});
	});

	describe("getAllAgents", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should return all agents", async () => {
			const agents = [mockAgent, { ...mockAgent, id: "agent-456", name: "Agent 2" }];
			const selectChain = {
				from: vi.fn(() => ({
					orderBy: vi.fn().mockResolvedValue(agents)
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			const result = await service.getAllAgents();

			expect(result).toEqual(agents);
			expect(result).toHaveLength(2);
		});

		it("should return empty array when no agents exist", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					orderBy: vi.fn().mockResolvedValue([])
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			const result = await service.getAllAgents();

			expect(result).toEqual([]);
			expect(result).toHaveLength(0);
		});

		it("should handle database error", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					orderBy: vi.fn().mockRejectedValue(new Error("DB error"))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			await expect(service.getAllAgents()).rejects.toThrow("DB error");
		});
	});

	describe("updateAgent", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should update agent successfully", async () => {
			const updatedAgent = { ...mockAgent, name: "Updated Agent" };
			const updateChain = {
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn().mockResolvedValue([updatedAgent])
					}))
				}))
			};
			mockDb.update.mockReturnValue(updateChain);

			const updateData = { name: "Updated Agent" };
			const result = await service.updateAgent("agent-123", updateData);

			expect(result).toEqual(updatedAgent);
			expect(updateChain.set).toHaveBeenCalledWith(updateData);
		});

		it("should throw NotFoundError when agent not found", async () => {
			const updateChain = {
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn().mockResolvedValue([])
					}))
				}))
			};
			mockDb.update.mockReturnValue(updateChain);

			const updateData = { name: "Updated Agent" };

			await expect(service.updateAgent("nonexistent-agent", updateData)).rejects.toThrow(
				NotFoundError
			);
		});

		it("should handle validation error", async () => {
			const updateData = { name: "" };

			await expect(service.updateAgent("agent-123", updateData)).rejects.toThrow(ValidationError);
		});

		it("should handle database error", async () => {
			const updateChain = {
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn().mockRejectedValue(new Error("DB error"))
					}))
				}))
			};
			mockDb.update.mockReturnValue(updateChain);

			const updateData = { name: "Updated Agent" };

			await expect(service.updateAgent("agent-123", updateData)).rejects.toThrow("DB error");
		});
	});

	describe("deleteAgent", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should delete agent successfully", async () => {
			// Mock channel-agent deletion
			const channelAgentDeleteChain = {
				where: vi.fn().mockResolvedValue([])
			};
			mockDb.delete.mockReturnValueOnce(channelAgentDeleteChain);

			// Mock agent deletion
			const agentDeleteChain = {
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockAgent])
				}))
			};
			mockDb.delete.mockReturnValueOnce(agentDeleteChain);

			const result = await service.deleteAgent("agent-123");

			expect(result).toBe(true);
			expect(mockDb.delete).toHaveBeenCalledTimes(2);
		});

		it("should return false when agent not found", async () => {
			// Mock channel-agent deletion
			const channelAgentDeleteChain = {
				where: vi.fn().mockResolvedValue([])
			};
			mockDb.delete.mockReturnValueOnce(channelAgentDeleteChain);

			// Mock agent deletion with no results
			const agentDeleteChain = {
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([])
				}))
			};
			mockDb.delete.mockReturnValueOnce(agentDeleteChain);

			const result = await service.deleteAgent("nonexistent-agent");

			expect(result).toBe(false);
		});

		it("should handle database error", async () => {
			const deleteChain = {
				where: vi.fn().mockRejectedValue(new Error("DB error"))
			};
			mockDb.delete.mockReturnValue(deleteChain);

			await expect(service.deleteAgent("agent-123")).rejects.toThrow("DB error");
		});
	});

	describe("getAgentsByChannel", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should return agents for channel", async () => {
			const agents = [mockAgent];
			const selectChain = {
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn().mockResolvedValue(agents)
						}))
					}))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			const result = await service.getAgentsByChannel("channel-123");

			expect(result).toEqual(agents);
		});

		it("should return empty array when no agents assigned", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn().mockResolvedValue([])
						}))
					}))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			const result = await service.getAgentsByChannel("channel-123");

			expect(result).toEqual([]);
		});

		it("should handle database error", async () => {
			const selectChain = {
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn().mockRejectedValue(new Error("DB error"))
						}))
					}))
				}))
			};
			mockDb.select.mockReturnValue(selectChain);

			await expect(service.getAgentsByChannel("channel-123")).rejects.toThrow("DB error");
		});
	});

	describe("assignAgentToChannel", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should assign agent to channel successfully", async () => {
			const insertChain = {
				values: vi.fn(() => ({
					onConflictDoNothing: vi.fn().mockResolvedValue([]),
					returning: vi.fn().mockResolvedValue([])
				}))
			};
			mockDb.insert.mockReturnValue(insertChain);

			await service.assignAgentToChannel("agent-123", "channel-123");

			expect(insertChain.values).toHaveBeenCalledWith({
				agentId: "agent-123",
				channelId: "channel-123"
			});
		});

		it("should handle database error", async () => {
			const insertChain = {
				values: vi.fn(() => ({
					onConflictDoNothing: vi.fn().mockRejectedValue(new Error("DB error")),
					returning: vi.fn().mockResolvedValue([])
				}))
			};
			mockDb.insert.mockReturnValue(insertChain);

			await expect(service.assignAgentToChannel("agent-123", "channel-123")).rejects.toThrow(
				"DB error"
			);
		});
	});

	describe("removeAgentFromChannel", () => {
		let service: AgentService;

		beforeEach(async () => {
			service = await AgentService.forTenant("tenant-123");
		});

		it("should remove agent from channel successfully", async () => {
			const deleteChain = {
				where: vi.fn().mockResolvedValue([])
			};
			mockDb.delete.mockReturnValue(deleteChain);

			await service.removeAgentFromChannel("agent-123", "channel-123");

			expect(mockDb.delete).toHaveBeenCalled();
		});

		it("should handle database error", async () => {
			const deleteChain = {
				where: vi.fn().mockRejectedValue(new Error("DB error"))
			};
			mockDb.delete.mockReturnValue(deleteChain);

			await expect(service.removeAgentFromChannel("agent-123", "channel-123")).rejects.toThrow(
				"DB error"
			);
		});
	});
});
