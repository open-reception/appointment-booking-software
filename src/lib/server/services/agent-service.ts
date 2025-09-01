import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectAgent } from "../db/tenant-schema";

import { eq } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError } from "../utils/errors";

const agentCreationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  logo: z.instanceof(Buffer).optional(),
});

const agentUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  logo: z.instanceof(Buffer).optional(),
});

export type AgentCreationRequest = z.infer<typeof agentCreationSchema>;
export type AgentUpdateRequest = z.infer<typeof agentUpdateSchema>;

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
          description: request.description,
          logo: request.logo,
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

      // First, remove all channel-agent associations
      await db
        .delete(tenantSchema.channelAgent)
        .where(eq(tenantSchema.channelAgent.agentId, agentId));

      // Then delete the agent
      const result = await db
        .delete(tenantSchema.agent)
        .where(eq(tenantSchema.agent.id, agentId))
        .returning();

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
          description: tenantSchema.agent.description,
          logo: tenantSchema.agent.logo,
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
   * Get the tenant's database connection (cached)
   */
  private async getDb() {
    if (!this.#db) {
      this.#db = await getTenantDb(this.tenantId);
    }
    return this.#db;
  }
}
