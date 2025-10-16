import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectAgent, type SelectAgentAbsence } from "../db/tenant-schema";

import { eq, and, between, or, lte, gte, ne } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";
import { supportedLocales } from "$lib/const/locales";

const agentCreationSchema = z.object({
  name: z.string().min(1).max(100),
  descriptions: z.partialRecord(z.enum(supportedLocales), z.string().min(1)).optional(),
  image: z.string().optional().nullable(),
  languages: z.array(z.string()).optional(),
});

const agentUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  descriptions: z.partialRecord(z.enum(supportedLocales), z.string().min(1)).optional(),
  image: z.string().optional().nullable(),
  languages: z.array(z.string()).optional(),
});

const absenceCreationSchema = z.object({
  agentId: z.string().uuid({ message: "Invalid UUID format" }),
  startDate: z.string().datetime({ message: "Invalid datetime format" }),
  endDate: z.string().datetime({ message: "Invalid datetime format" }),
  absenceType: z.string().min(1).max(100),
  description: z.string().optional(),
});

const absenceUpdateSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid datetime format" }).optional(),
  endDate: z.string().datetime({ message: "Invalid datetime format" }).optional(),
  absenceType: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

const absenceQuerySchema = z.object({
  agentId: z.string().uuid({ message: "Invalid UUID format" }).optional(),
  startDate: z.string().datetime({ message: "Invalid datetime format" }),
  endDate: z.string().datetime({ message: "Invalid datetime format" }),
});

export type AgentCreationRequest = z.infer<typeof agentCreationSchema>;
export type AgentUpdateRequest = z.infer<typeof agentUpdateSchema>;
export type AbsenceCreationRequest = z.infer<typeof absenceCreationSchema>;
export type AbsenceUpdateRequest = z.infer<typeof absenceUpdateSchema>;
export type AbsenceQueryRequest = z.infer<typeof absenceQuerySchema>;

export class AgentService {
  #db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

  private constructor(public readonly tenantId: string) {}

  /**
   * Create an agent service for a specific tenant
   * @param tenantId The ID of the tenant
   * @returns new AgentService instance
   */
  static async forTenant(tenantId: string) {
    const log = logger.setContext("AgentService");
    log.debug("Creating agent service for tenant", { tenantId });

    try {
      const service = new AgentService(tenantId);
      service.#db = await getTenantDb(tenantId);

      log.debug("Agent service created successfully", { tenantId });
      return service;
    } catch (error) {
      log.error("Failed to create agent service", { tenantId, error: String(error) });
      throw error;
    }
  }

  /**
   * Create a new agent
   * @param request Agent creation request data
   * @returns Created agent
   */
  async createAgent(request: AgentCreationRequest): Promise<SelectAgent> {
    const log = logger.setContext("AgentService");

    const validation = agentCreationSchema.safeParse(request);
    if (!validation.success) {
      throw new ValidationError("Invalid agent creation request");
    }

    log.debug("Creating new agent", {
      tenantId: this.tenantId,
      name: request.name,
    });

    try {
      const db = await this.getDb();
      const result = await db
        .insert(tenantSchema.agent)
        .values({
          name: request.name,
          descriptions: request.descriptions ?? {},
          image: request.image,
        })
        .returning();

      log.debug("Agent created successfully", {
        tenantId: this.tenantId,
        agentId: result[0].id,
        name: result[0].name,
      });

      return result[0];
    } catch (error) {
      log.error("Failed to create agent", {
        tenantId: this.tenantId,
        name: request.name,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get an agent by ID
   * @param agentId Agent ID
   * @returns Agent or null if not found
   */
  async getAgentById(agentId: string): Promise<SelectAgent | null> {
    const log = logger.setContext("AgentService");
    log.debug("Getting agent by ID", { tenantId: this.tenantId, agentId });

    try {
      const db = await this.getDb();
      const result = await db
        .select()
        .from(tenantSchema.agent)
        .where(eq(tenantSchema.agent.id, agentId))
        .limit(1);

      if (result.length === 0) {
        log.debug("Agent not found", { tenantId: this.tenantId, agentId });
        return null;
      }

      log.debug("Agent found", { tenantId: this.tenantId, agentId });
      return result[0];
    } catch (error) {
      log.error("Failed to get agent by ID", {
        tenantId: this.tenantId,
        agentId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get all agents for the tenant
   * @returns Array of agents
   */
  async getAllAgents(): Promise<SelectAgent[]> {
    const log = logger.setContext("AgentService");
    log.debug("Getting all agents", { tenantId: this.tenantId });

    try {
      const db = await this.getDb();
      const result = await db.select().from(tenantSchema.agent).orderBy(tenantSchema.agent.name);

      log.debug("Retrieved all agents", {
        tenantId: this.tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      log.error("Failed to get all agents", {
        tenantId: this.tenantId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Update an existing agent
   * @param agentId Agent ID
   * @param updateData Agent update data
   * @returns Updated agent
   */
  async updateAgent(agentId: string, updateData: AgentUpdateRequest): Promise<SelectAgent> {
    const log = logger.setContext("AgentService");

    const validation = agentUpdateSchema.safeParse(updateData);
    if (!validation.success) {
      throw new ValidationError("Invalid agent update request");
    }

    log.debug("Updating agent", {
      tenantId: this.tenantId,
      agentId,
      updateFields: Object.keys(updateData),
    });

    try {
      const db = await this.getDb();
      const result = await db
        .update(tenantSchema.agent)
        .set(updateData)
        .where(eq(tenantSchema.agent.id, agentId))
        .returning();

      if (result.length === 0) {
        log.warn("Agent update failed: Agent not found", {
          tenantId: this.tenantId,
          agentId,
        });
        throw new NotFoundError(`Agent with ID ${agentId} not found`);
      }

      log.debug("Agent updated successfully", {
        tenantId: this.tenantId,
        agentId,
        updateFields: Object.keys(updateData),
      });

      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("Failed to update agent", {
        tenantId: this.tenantId,
        agentId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Delete an agent
   * @param agentId Agent ID
   * @returns true if deleted, false if not found
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    const log = logger.setContext("AgentService");
    log.debug("Deleting agent", { tenantId: this.tenantId, agentId });

    try {
      const db = await this.getDb();

      const result = await db.transaction(async (tx) => {
        // First, remove all channel-agent associations
        await tx
          .delete(tenantSchema.channelAgent)
          .where(eq(tenantSchema.channelAgent.agentId, agentId));

        // Then delete the agent
        return await tx
          .delete(tenantSchema.agent)
          .where(eq(tenantSchema.agent.id, agentId))
          .returning();
      });

      if (result.length === 0) {
        log.debug("Agent deletion failed: Agent not found", {
          tenantId: this.tenantId,
          agentId,
        });
        return false;
      }

      log.debug("Agent deleted successfully", {
        tenantId: this.tenantId,
        agentId,
      });

      return true;
    } catch (error) {
      log.error("Failed to delete agent", {
        tenantId: this.tenantId,
        agentId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get agents assigned to a specific channel
   * @param channelId Channel ID
   * @returns Array of agents assigned to the channel
   */
  async getAgentsByChannel(channelId: string): Promise<SelectAgent[]> {
    const log = logger.setContext("AgentService");
    log.debug("Getting agents by channel", { tenantId: this.tenantId, channelId });

    try {
      const db = await this.getDb();
      const result = await db
        .select({
          id: tenantSchema.agent.id,
          name: tenantSchema.agent.name,
          descriptions: tenantSchema.agent.descriptions,
          image: tenantSchema.agent.image,
        })
        .from(tenantSchema.agent)
        .innerJoin(
          tenantSchema.channelAgent,
          eq(tenantSchema.agent.id, tenantSchema.channelAgent.agentId),
        )
        .where(eq(tenantSchema.channelAgent.channelId, channelId))
        .orderBy(tenantSchema.agent.name);

      log.debug("Retrieved agents by channel", {
        tenantId: this.tenantId,
        channelId,
        count: result.length,
      });

      return result;
    } catch (error) {
      log.error("Failed to get agents by channel", {
        tenantId: this.tenantId,
        channelId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Assign an agent to a channel
   * @param agentId Agent ID
   * @param channelId Channel ID
   */
  async assignAgentToChannel(agentId: string, channelId: string): Promise<void> {
    const log = logger.setContext("AgentService");
    log.debug("Assigning agent to channel", {
      tenantId: this.tenantId,
      agentId,
      channelId,
    });

    try {
      const db = await this.getDb();
      await db
        .insert(tenantSchema.channelAgent)
        .values({
          agentId,
          channelId,
        })
        .onConflictDoNothing();

      log.debug("Agent assigned to channel successfully", {
        tenantId: this.tenantId,
        agentId,
        channelId,
      });
    } catch (error) {
      log.error("Failed to assign agent to channel", {
        tenantId: this.tenantId,
        agentId,
        channelId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Remove an agent from a channel
   * @param agentId Agent ID
   * @param channelId Channel ID
   */
  async removeAgentFromChannel(agentId: string, channelId: string): Promise<void> {
    const log = logger.setContext("AgentService");
    log.debug("Removing agent from channel", {
      tenantId: this.tenantId,
      agentId,
      channelId,
    });

    try {
      const db = await this.getDb();
      await db
        .delete(tenantSchema.channelAgent)
        .where(
          eq(tenantSchema.channelAgent.agentId, agentId) &&
            eq(tenantSchema.channelAgent.channelId, channelId),
        );

      log.debug("Agent removed from channel successfully", {
        tenantId: this.tenantId,
        agentId,
        channelId,
      });
    } catch (error) {
      log.error("Failed to remove agent from channel", {
        tenantId: this.tenantId,
        agentId,
        channelId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Create a new absence for an agent
   * @param request Absence creation request data
   * @returns Created absence
   */
  async createAbsence(request: AbsenceCreationRequest): Promise<SelectAgentAbsence> {
    const log = logger.setContext("AgentService");

    const validation = absenceCreationSchema.safeParse(request);
    if (!validation.success) {
      throw new ValidationError("Invalid absence creation request");
    }

    // Validate date range
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);
    if (startDate > endDate) {
      throw new ValidationError("End date must be after start date");
    }

    log.debug("Creating new absence", {
      tenantId: this.tenantId,
      agentId: request.agentId,
      absenceType: request.absenceType,
      startDate: request.startDate,
      endDate: request.endDate,
    });

    try {
      const db = await this.getDb();

      // Verify agent exists
      const agent = await db
        .select()
        .from(tenantSchema.agent)
        .where(eq(tenantSchema.agent.id, request.agentId))
        .limit(1);

      if (agent.length === 0) {
        throw new NotFoundError(`Agent with ID ${request.agentId} not found`);
      }

      // Check for overlapping absences
      const overlappingAbsences = await db
        .select()
        .from(tenantSchema.agentAbsence)
        .where(
          and(
            eq(tenantSchema.agentAbsence.agentId, request.agentId),
            or(
              // New absence starts during existing absence
              and(
                between(
                  tenantSchema.agentAbsence.startDate,
                  new Date(request.startDate),
                  new Date(request.endDate),
                ),
              ),
              // New absence ends during existing absence
              and(
                between(
                  tenantSchema.agentAbsence.endDate,
                  new Date(request.startDate),
                  new Date(request.endDate),
                ),
              ),
              // New absence entirely contains existing absence
              and(
                gte(tenantSchema.agentAbsence.startDate, new Date(request.startDate)),
                lte(tenantSchema.agentAbsence.endDate, new Date(request.endDate)),
              ),
            ),
          ),
        );

      if (overlappingAbsences.length > 0) {
        throw new ConflictError("Absence period overlaps with existing absence");
      }

      const result = await db
        .insert(tenantSchema.agentAbsence)
        .values({
          agentId: request.agentId,
          startDate: new Date(request.startDate),
          endDate: new Date(request.endDate),
          absenceType: request.absenceType,
          description: request.description,
        })
        .returning();

      log.debug("Absence created successfully", {
        tenantId: this.tenantId,
        absenceId: result[0].id,
        agentId: request.agentId,
      });

      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
      log.error("Failed to create absence", {
        tenantId: this.tenantId,
        agentId: request.agentId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get absence by ID
   * @param absenceId Absence ID
   * @returns Absence or null if not found
   */
  async getAbsenceById(absenceId: string): Promise<SelectAgentAbsence | null> {
    const log = logger.setContext("AgentService");
    log.debug("Getting absence by ID", { tenantId: this.tenantId, absenceId });

    try {
      const db = await this.getDb();
      const result = await db
        .select()
        .from(tenantSchema.agentAbsence)
        .where(eq(tenantSchema.agentAbsence.id, absenceId))
        .limit(1);

      if (result.length === 0) {
        log.debug("Absence not found", { tenantId: this.tenantId, absenceId });
        return null;
      }

      log.debug("Absence found", { tenantId: this.tenantId, absenceId });
      return result[0];
    } catch (error) {
      log.error("Failed to get absence by ID", {
        tenantId: this.tenantId,
        absenceId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Query absences with filters
   * @param query Query parameters
   * @returns Array of absences matching criteria
   */
  async queryAbsences(query: AbsenceQueryRequest): Promise<SelectAgentAbsence[]> {
    const log = logger.setContext("AgentService");

    const validation = absenceQuerySchema.safeParse(query);
    if (!validation.success) {
      throw new ValidationError("Invalid absence query request");
    }

    log.debug("Querying absences", {
      tenantId: this.tenantId,
      agentId: query.agentId,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    try {
      const db = await this.getDb();

      // Build where conditions
      const conditions = [
        or(
          // Absence starts within query period
          between(
            tenantSchema.agentAbsence.startDate,
            new Date(query.startDate),
            new Date(query.endDate),
          ),
          // Absence ends within query period
          between(
            tenantSchema.agentAbsence.endDate,
            new Date(query.startDate),
            new Date(query.endDate),
          ),
          // Absence spans entire query period (absence starts before query and ends after query)
          and(
            lte(tenantSchema.agentAbsence.startDate, new Date(query.startDate)),
            gte(tenantSchema.agentAbsence.endDate, new Date(query.endDate)),
          ),
        ),
      ];

      if (query.agentId) {
        conditions.push(eq(tenantSchema.agentAbsence.agentId, query.agentId));
      }

      const result = await db
        .select()
        .from(tenantSchema.agentAbsence)
        .where(and(...conditions))
        .orderBy(tenantSchema.agentAbsence.startDate);

      log.debug("Retrieved absences", {
        tenantId: this.tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      log.error("Failed to query absences", {
        tenantId: this.tenantId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get all absences for a tenant
   * @param startDate Optional start date filter
   * @param endDate Optional end date filter
   * @returns Array of agent absences
   */
  async getAbsences(startDate?: string, endDate?: string): Promise<SelectAgentAbsence[]> {
    const log = logger.setContext("AgentService");
    log.debug("Getting all absences", {
      tenantId: this.tenantId,
      startDate,
      endDate,
    });

    try {
      const db = await this.getDb();

      const query = db.select().from(tenantSchema.agentAbsence);

      // Add date filters if provided
      if (startDate && endDate) {
        const result = await this.queryAbsences({
          startDate,
          endDate,
        });
        return result;
      }

      const result = await query.orderBy(tenantSchema.agentAbsence.startDate);

      log.debug("Retrieved agent absences", {
        tenantId: this.tenantId,
        count: result.length,
      });

      return result;
    } catch (error) {
      log.error("Failed to get agent absences", {
        tenantId: this.tenantId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get all absences for a specific agent
   * @param agentId Agent ID
   * @param startDate Optional start date filter
   * @param endDate Optional end date filter
   * @returns Array of agent absences
   */
  async getAgentAbsences(
    agentId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<SelectAgentAbsence[]> {
    const log = logger.setContext("AgentService");
    log.debug("Getting agent absences", {
      tenantId: this.tenantId,
      agentId,
      startDate,
      endDate,
    });

    try {
      const db = await this.getDb();

      const query = db
        .select()
        .from(tenantSchema.agentAbsence)
        .where(eq(tenantSchema.agentAbsence.agentId, agentId));

      // Add date filters if provided
      if (startDate && endDate) {
        const result = await this.queryAbsences({
          agentId,
          startDate,
          endDate,
        });
        return result;
      }

      const result = await query.orderBy(tenantSchema.agentAbsence.startDate);

      log.debug("Retrieved agent absences", {
        tenantId: this.tenantId,
        agentId,
        count: result.length,
      });

      return result;
    } catch (error) {
      log.error("Failed to get agent absences", {
        tenantId: this.tenantId,
        agentId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Update an existing absence
   * @param absenceId Absence ID
   * @param updateData Absence update data
   * @returns Updated absence
   */
  async updateAbsence(
    absenceId: string,
    updateData: AbsenceUpdateRequest,
  ): Promise<SelectAgentAbsence> {
    const log = logger.setContext("AgentService");

    const validation = absenceUpdateSchema.safeParse(updateData);
    if (!validation.success) {
      throw new ValidationError("Invalid absence update request");
    }

    log.debug("Updating absence", {
      tenantId: this.tenantId,
      absenceId,
      updateFields: Object.keys(updateData),
    });

    try {
      const db = await this.getDb();

      // Get current absence data
      const currentAbsence = await db
        .select()
        .from(tenantSchema.agentAbsence)
        .where(eq(tenantSchema.agentAbsence.id, absenceId))
        .limit(1);

      if (currentAbsence.length === 0) {
        throw new NotFoundError(`Absence with ID ${absenceId} not found`);
      }

      // If updating dates, validate the new date range
      if (updateData.startDate || updateData.endDate) {
        const newStartDate = updateData.startDate || currentAbsence[0].startDate;
        const newEndDate = updateData.endDate || currentAbsence[0].endDate;

        if (new Date(newStartDate) > new Date(newEndDate)) {
          throw new ValidationError("End date must be after start date");
        }

        // Check for overlapping absences (excluding current absence)
        const overlappingAbsences = await db
          .select()
          .from(tenantSchema.agentAbsence)
          .where(
            and(
              eq(tenantSchema.agentAbsence.agentId, currentAbsence[0].agentId),
              // Exclude current absence from check
              ne(tenantSchema.agentAbsence.id, absenceId),
              or(
                between(
                  tenantSchema.agentAbsence.startDate,
                  new Date(newStartDate),
                  new Date(newEndDate),
                ),
                between(
                  tenantSchema.agentAbsence.endDate,
                  new Date(newStartDate),
                  new Date(newEndDate),
                ),
                // New period entirely contains existing absence
                and(
                  gte(tenantSchema.agentAbsence.startDate, new Date(newStartDate)),
                  lte(tenantSchema.agentAbsence.endDate, new Date(newEndDate)),
                ),
              ),
            ),
          );

        if (overlappingAbsences.length > 0) {
          throw new ConflictError("Updated absence period overlaps with existing absence");
        }
      }

      // Convert string dates to Date objects for database
      const dbUpdateData = {
        ...updateData,
        startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
      };

      const result = await db
        .update(tenantSchema.agentAbsence)
        .set(dbUpdateData)
        .where(eq(tenantSchema.agentAbsence.id, absenceId))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError(`Absence with ID ${absenceId} not found`);
      }

      log.debug("Absence updated successfully", {
        tenantId: this.tenantId,
        absenceId,
        updateFields: Object.keys(updateData),
      });

      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
      log.error("Failed to update absence", {
        tenantId: this.tenantId,
        absenceId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Delete an absence
   * @param absenceId Absence ID
   * @returns true if deleted, false if not found
   */
  async deleteAbsence(absenceId: string): Promise<boolean> {
    const log = logger.setContext("AgentService");
    log.debug("Deleting absence", { tenantId: this.tenantId, absenceId });

    try {
      const db = await this.getDb();
      const result = await db
        .delete(tenantSchema.agentAbsence)
        .where(eq(tenantSchema.agentAbsence.id, absenceId))
        .returning();

      if (result.length === 0) {
        log.debug("Absence deletion failed: Absence not found", {
          tenantId: this.tenantId,
          absenceId,
        });
        return false;
      }

      log.debug("Absence deleted successfully", {
        tenantId: this.tenantId,
        absenceId,
      });

      return true;
    } catch (error) {
      log.error("Failed to delete absence", {
        tenantId: this.tenantId,
        absenceId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get the tenant's database connection (cached)
   */
  private async getDb() {
    if (!this.#db) {
      this.#db = await getTenantDb(this.tenantId);
    }
    return this.#db;
  }
}
