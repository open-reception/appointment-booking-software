/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError, NotFoundError, ConflictError } from "../../utils/errors";

// Mock dependencies before imports
vi.mock("../../db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

// Import after mocking
import { AgentService, type AbsenceCreationRequest } from "../agent-service";
import { getTenantDb } from "../../db";

// Mock database operations
const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(),
      })),
      orderBy: vi.fn(),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(),
        })),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
};

const mockAgent = {
  id: "agent-123",
  name: "Test Agent",
  description: "Test description",
  logo: Buffer.from("test"),
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
          returning: vi.fn().mockResolvedValue([mockAgent]),
        })),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const request = {
        name: "Test Agent",
        description: ["Test description"],
        image: "test",
      };

      const result = await service.createAgent(request);

      expect(result).toEqual(mockAgent);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith({
        name: "Test Agent",
        description: "Test description",
        image: "test",
      });
    });

    it("should handle validation error for invalid name", async () => {
      const request = {
        name: "",
        description: ["Test description"],
      };

      await expect(service.createAgent(request)).rejects.toThrow(ValidationError);
    });

    it("should handle database error during creation", async () => {
      const insertChain = {
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const request = {
        name: "Test Agent",
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
            limit: vi.fn().mockResolvedValue([mockAgent]),
          })),
        })),
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
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.getAgentById("nonexistent-agent");

      expect(result).toBeNull();
    });

    it("should handle database error", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
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
          orderBy: vi.fn().mockResolvedValue(agents),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.getAllAgents();

      expect(result).toEqual(agents);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no agents exist", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.getAllAgents();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("should handle database error", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          orderBy: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
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
            returning: vi.fn().mockResolvedValue([updatedAgent]),
          })),
        })),
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
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
      mockDb.update.mockReturnValue(updateChain);

      const updateData = { name: "Updated Agent" };

      await expect(service.updateAgent("nonexistent-agent", updateData)).rejects.toThrow(
        NotFoundError,
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
            returning: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
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
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.delete.mockReturnValueOnce(channelAgentDeleteChain);

      // Mock agent deletion
      const agentDeleteChain = {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([mockAgent]),
        })),
      };
      mockDb.delete.mockReturnValueOnce(agentDeleteChain);

      const result = await service.deleteAgent("agent-123");

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it("should return false when agent not found", async () => {
      // Mock channel-agent deletion
      const channelAgentDeleteChain = {
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.delete.mockReturnValueOnce(channelAgentDeleteChain);

      // Mock agent deletion with no results
      const agentDeleteChain = {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      };
      mockDb.delete.mockReturnValueOnce(agentDeleteChain);

      const result = await service.deleteAgent("nonexistent-agent");

      expect(result).toBe(false);
    });

    it("should handle database error", async () => {
      const deleteChain = {
        where: vi.fn().mockRejectedValue(new Error("DB error")),
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
              orderBy: vi.fn().mockResolvedValue(agents),
            })),
          })),
        })),
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
              orderBy: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
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
              orderBy: vi.fn().mockRejectedValue(new Error("DB error")),
            })),
          })),
        })),
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
          returning: vi.fn().mockResolvedValue([]),
        })),
      };
      mockDb.insert.mockReturnValue(insertChain);

      await service.assignAgentToChannel("agent-123", "channel-123");

      expect(insertChain.values).toHaveBeenCalledWith({
        agentId: "agent-123",
        channelId: "channel-123",
      });
    });

    it("should handle database error", async () => {
      const insertChain = {
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockRejectedValue(new Error("DB error")),
          returning: vi.fn().mockResolvedValue([]),
        })),
      };
      mockDb.insert.mockReturnValue(insertChain);

      await expect(service.assignAgentToChannel("agent-123", "channel-123")).rejects.toThrow(
        "DB error",
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
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      await service.removeAgentFromChannel("agent-123", "channel-123");

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should handle database error", async () => {
      const deleteChain = {
        where: vi.fn().mockRejectedValue(new Error("DB error")),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      await expect(service.removeAgentFromChannel("agent-123", "channel-123")).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("Absence Management", () => {
    let service: AgentService;
    const mockAbsence = {
      id: "absence-123",
      agentId: "agent-123",
      startDate: "2024-01-01T08:00:00.000Z",
      endDate: "2024-01-01T17:00:00.000Z",
      absenceType: "Urlaub",
      description: "Annual vacation",
    };

    beforeEach(async () => {
      service = await AgentService.forTenant("tenant-123");
    });

    describe("createAbsence", () => {
      it("should create absence successfully", async () => {
        const request: AbsenceCreationRequest = {
          agentId: "123e4567-e89b-12d3-a456-426614174001",
          startDate: "2024-01-01T08:00:00.000Z",
          endDate: "2024-01-01T17:00:00.000Z",
          absenceType: "Urlaub",
          description: "Annual vacation",
        };

        // Mock agent exists
        const selectChainForAgent = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([mockAgent]),
            })),
          })),
        };

        // Mock no overlapping absences
        const selectChainForOverlap = {
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        };

        let selectCallCount = 0;
        mockDb.select.mockImplementation(() => {
          selectCallCount++;
          return selectCallCount === 1 ? selectChainForAgent : selectChainForOverlap;
        });

        const insertChain = {
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockAbsence]),
          })),
        };
        mockDb.insert.mockReturnValue(insertChain);

        const result = await service.createAbsence(request);

        expect(result).toEqual(mockAbsence);
        expect(insertChain.values).toHaveBeenCalledWith({
          agentId: request.agentId,
          startDate: new Date(request.startDate),
          endDate: new Date(request.endDate),
          absenceType: request.absenceType,
          description: request.description,
        });
      });

      it("should validate absence creation request", async () => {
        const invalidRequest = {
          agentId: "invalid-uuid",
          startDate: "invalid-date",
          endDate: "2024-01-01T17:00:00.000Z",
          absenceType: "",
          description: "",
        };

        await expect(
          service.createAbsence(invalidRequest as AbsenceCreationRequest),
        ).rejects.toThrow(ValidationError);
      });

      it("should validate date range", async () => {
        const request: AbsenceCreationRequest = {
          agentId: "agent-123",
          startDate: "2024-01-01T17:00:00.000Z", // End before start
          endDate: "2024-01-01T08:00:00.000Z",
          absenceType: "Urlaub",
        };

        await expect(service.createAbsence(request)).rejects.toThrow(ValidationError);
      });

      it("should throw NotFoundError if agent does not exist", async () => {
        const request: AbsenceCreationRequest = {
          agentId: "123e4567-e89b-12d3-a456-426614174099", // Valid UUID format
          startDate: "2024-01-01T08:00:00.000Z",
          endDate: "2024-01-01T17:00:00.000Z",
          absenceType: "Urlaub",
        };

        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain);

        await expect(service.createAbsence(request)).rejects.toThrow(NotFoundError);
      });

      it("should throw ConflictError if absence period overlaps", async () => {
        const request: AbsenceCreationRequest = {
          agentId: "123e4567-e89b-12d3-a456-426614174001",
          startDate: "2024-01-01T08:00:00.000Z",
          endDate: "2024-01-01T17:00:00.000Z",
          absenceType: "Urlaub",
        };

        // Mock agent exists
        const selectChainForAgent = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([mockAgent]),
            })),
          })),
        };

        // Mock overlapping absence exists
        const selectChainForOverlap = {
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([mockAbsence]),
          })),
        };

        let selectCallCount = 0;
        mockDb.select.mockImplementation(() => {
          selectCallCount++;
          return selectCallCount === 1 ? selectChainForAgent : selectChainForOverlap;
        });

        await expect(service.createAbsence(request)).rejects.toThrow(ConflictError);
      });
    });

    describe("getAbsenceById", () => {
      it("should return absence when found", async () => {
        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([mockAbsence]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain);

        const result = await service.getAbsenceById("absence-123");

        expect(result).toEqual(mockAbsence);
      });

      it("should return null when absence not found", async () => {
        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain);

        const result = await service.getAbsenceById("non-existent");

        expect(result).toBeNull();
      });
    });

    describe("getAgentAbsences", () => {
      it("should return agent absences", async () => {
        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue([mockAbsence]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain as any);

        const result = await service.getAgentAbsences("agent-123");

        expect(result).toEqual([mockAbsence]);
      });

      it("should filter by date range when provided", async () => {
        // Mock the queryAbsences method behavior
        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue([mockAbsence]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain as any);

        const result = await service.getAgentAbsences(
          "123e4567-e89b-12d3-a456-426614174001",
          "2024-01-01T00:00:00.000Z",
          "2024-01-31T23:59:59.999Z",
        );

        expect(result).toEqual([mockAbsence]);
      });
    });

    describe("updateAbsence", () => {
      it("should update absence successfully", async () => {
        const updateData = {
          absenceType: "Krankheit",
          description: "Sick leave",
        };

        // Mock current absence exists
        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([mockAbsence]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain);

        const updateChain = {
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ ...mockAbsence, ...updateData }]),
            })),
          })),
        };
        mockDb.update.mockReturnValue(updateChain);

        const result = await service.updateAbsence("absence-123", updateData);

        expect(result.absenceType).toBe(updateData.absenceType);
        expect(result.description).toBe(updateData.description);
      });

      it("should validate update request", async () => {
        const invalidUpdate = {
          absenceType: "", // Invalid empty type
          startDate: "invalid-date",
        };

        await expect(service.updateAbsence("absence-123", invalidUpdate)).rejects.toThrow(
          ValidationError,
        );
      });

      it("should throw NotFoundError if absence does not exist", async () => {
        const updateData = { absenceType: "Krankheit" };

        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain);

        await expect(service.updateAbsence("non-existent", updateData)).rejects.toThrow(
          NotFoundError,
        );
      });

      it("should validate new date range", async () => {
        const updateData = {
          startDate: "2024-01-01T17:00:00.000Z", // End before start
          endDate: "2024-01-01T08:00:00.000Z",
        };

        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([mockAbsence]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain);

        await expect(service.updateAbsence("absence-123", updateData)).rejects.toThrow(
          ValidationError,
        );
      });
    });

    describe("deleteAbsence", () => {
      it("should delete absence successfully", async () => {
        const deleteChain = {
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockAbsence]),
          })),
        };
        mockDb.delete.mockReturnValue(deleteChain);

        const result = await service.deleteAbsence("absence-123");

        expect(result).toBe(true);
      });

      it("should return false if absence not found", async () => {
        const deleteChain = {
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        };
        mockDb.delete.mockReturnValue(deleteChain);

        const result = await service.deleteAbsence("non-existent");

        expect(result).toBe(false);
      });
    });

    describe("queryAbsences", () => {
      it("should validate query request", async () => {
        const invalidQuery = {
          startDate: "invalid-date",
          endDate: "2024-01-31T23:59:59.999Z",
        };

        await expect(service.queryAbsences(invalidQuery as any)).rejects.toThrow(ValidationError);
      });

      it("should query absences with date range", async () => {
        const validQuery = {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-31T23:59:59.999Z",
          agentId: "123e4567-e89b-12d3-a456-426614174001",
        };

        const selectChain = {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn().mockResolvedValue([mockAbsence]),
            })),
          })),
        };
        mockDb.select.mockReturnValue(selectChain as any);

        const result = await service.queryAbsences(validQuery);

        expect(result).toEqual([mockAbsence]);
      });
    });
  });
});
