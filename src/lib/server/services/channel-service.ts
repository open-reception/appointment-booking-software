import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectChannel, type SelectSlotTemplate, type SelectAgent } from "../db/tenant-schema";

import { eq, inArray } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError } from "../utils/errors";
import { TenantConfig } from "../db/tenant-config";

const CHANNEL_COLORS = ["#FF0000", "#00FF00", "#0000FF"] as const;
const NEXT_COLOR_KEY = "nextChannelColor";

const slotTemplateSchema = z.object({
	name: z.string().min(1).max(100),
	weekdays: z.number().int().min(0).max(127).optional(),
	from: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
	to: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
	duration: z.number().int().min(1).max(1440)
});

const channelCreationSchema = z
	.object({
		names: z.array(z.string().min(1).max(100)).min(1),
		color: z.string().optional(),
		descriptions: z.array(z.string()).optional(),
		languages: z.array(z.string().min(2).max(5)).min(1),
		isPublic: z.boolean().optional(),
		requiresConfirmation: z.boolean().optional(),
		agentIds: z.array(z.string().uuid()).optional().default([]),
		slotTemplates: z.array(slotTemplateSchema).optional().default([])
	})
	.refine(
		(data) =>
			!data.descriptions ||
			data.descriptions.length === 0 ||
			data.descriptions.length === data.languages.length,
		{ message: "descriptions array must have same length as languages array" }
	)
	.refine((data) => data.names.length === data.languages.length, {
		message: "names array must have same length as languages array"
	});

const channelUpdateSchema = z
	.object({
		names: z.array(z.string().min(1).max(100)).optional(),
		color: z.string().optional(),
		descriptions: z.array(z.string()).optional(),
		languages: z.array(z.string().min(2).max(5)).optional(),
		isPublic: z.boolean().optional(),
		requiresConfirmation: z.boolean().optional(),
		agentIds: z.array(z.string().uuid()).optional(),
		slotTemplates: z
			.array(
				slotTemplateSchema.extend({
					id: z.string().uuid().optional()
				})
			)
			.optional()
	})
	.refine(
		(data) =>
			!data.descriptions ||
			!data.languages ||
			data.descriptions.length === 0 ||
			data.descriptions.length === data.languages.length,
		{ message: "descriptions array must have same length as languages array" }
	)
	.refine((data) => !data.names || !data.languages || data.names.length === data.languages.length, {
		message: "names array must have same length as languages array"
	});

export type ChannelCreationRequest = z.infer<typeof channelCreationSchema>;
export type ChannelUpdateRequest = z.infer<typeof channelUpdateSchema>;
export type SlotTemplateRequest = z.infer<typeof slotTemplateSchema>;

export interface ChannelWithRelations extends SelectChannel {
	agents: SelectAgent[];
	slotTemplates: SelectSlotTemplate[];
}

export class ChannelService {
	#db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

	private constructor(public readonly tenantId: string) {}

	/**
	 * Create a channel service for a specific tenant
	 * @param tenantId The ID of the tenant
	 * @returns new ChannelService instance
	 */
	static async forTenant(tenantId: string) {
		const log = logger.setContext("ChannelService");
		log.debug("Creating channel service for tenant", { tenantId });

		try {
			const service = new ChannelService(tenantId);
			service.#db = await getTenantDb(tenantId);

			log.debug("Channel service created successfully", { tenantId });
			return service;
		} catch (error) {
			log.error("Failed to create channel service", { tenantId, error: String(error) });
			throw error;
		}
	}

	/**
	 * Create a new channel with agents and slot templates
	 * @param request Channel creation request data
	 * @returns Created channel with relations
	 */
	async createChannel(request: ChannelCreationRequest): Promise<ChannelWithRelations> {
		const log = logger.setContext("ChannelService");

		const validation = channelCreationSchema.safeParse(request);
		if (!validation.success) {
			throw new ValidationError("Invalid channel creation request");
		}

		if (!request.color) {
			// Automatically set the channel color if none is given
			const configService = await TenantConfig.create(this.tenantId);
			const config = configService.configuration;
			const nextIndex = config[NEXT_COLOR_KEY] as number;
			request.color = CHANNEL_COLORS[nextIndex];
			await configService.setConfig(
				NEXT_COLOR_KEY,
				nextIndex + 1 === CHANNEL_COLORS.length ? 0 : nextIndex + 1
			);
		}

		log.debug("Creating new channel", {
			tenantId: this.tenantId,
			names: request.names,
			languages: request.languages,
			agentCount: request.agentIds?.length || 0,
			slotTemplateCount: request.slotTemplates?.length || 0
		});

		try {
			const db = await this.getDb();

			// Start transaction
			const result = await db.transaction(async (tx) => {
				// 1. Create the channel
				const channelResult = await tx
					.insert(tenantSchema.channel)
					.values({
						names: request.names,
						color: request.color,
						descriptions: request.descriptions || [],
						languages: request.languages,
						isPublic: request.isPublic,
						requiresConfirmation: request.requiresConfirmation
					})
					.returning();

				const channel = channelResult[0];

				// 2. Create slot templates and link them to the channel
				const slotTemplates: SelectSlotTemplate[] = [];
				if (request.slotTemplates && request.slotTemplates.length > 0) {
					for (const slotTemplateData of request.slotTemplates) {
						const slotTemplateResult = await tx
							.insert(tenantSchema.slotTemplate)
							.values({
								weekdays: slotTemplateData.weekdays,
								from: slotTemplateData.from,
								to: slotTemplateData.to,
								duration: slotTemplateData.duration
							})
							.returning();

						const slotTemplate = slotTemplateResult[0];
						slotTemplates.push(slotTemplate);

						// Link slot template to channel
						await tx.insert(tenantSchema.channelSlotTemplate).values({
							channelId: channel.id,
							slotTemplateId: slotTemplate.id
						});
					}
				}

				// 3. Link agents to the channel
				const agents: SelectAgent[] = [];
				if (request.agentIds && request.agentIds.length > 0) {
					// Verify agents exist
					const existingAgents = await tx
						.select()
						.from(tenantSchema.agent)
						.where(inArray(tenantSchema.agent.id, request.agentIds));

					if (existingAgents.length !== request.agentIds.length) {
						throw new ValidationError("One or more agents not found");
					}

					// Link agents to channel
					for (const agentId of request.agentIds) {
						await tx.insert(tenantSchema.channelAgent).values({
							channelId: channel.id,
							agentId: agentId
						});
					}

					agents.push(...existingAgents);
				}

				return {
					...channel,
					agents,
					slotTemplates
				};
			});

			log.debug("Channel created successfully", {
				tenantId: this.tenantId,
				channelId: result.id,
				names: result.names,
				languages: result.languages,
				agentCount: result.agents.length,
				slotTemplateCount: result.slotTemplates.length
			});

			return result;
		} catch (error) {
			log.error("Failed to create channel", {
				tenantId: this.tenantId,
				names: request.names,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Update an existing channel with relationship management
	 * @param channelId Channel ID
	 * @param updateData Channel update data
	 * @returns Updated channel with relations
	 */
	async updateChannel(
		channelId: string,
		updateData: ChannelUpdateRequest
	): Promise<ChannelWithRelations> {
		const log = logger.setContext("ChannelService");

		const validation = channelUpdateSchema.safeParse(updateData);
		if (!validation.success) {
			throw new ValidationError("Invalid channel update request");
		}

		log.debug("Updating channel", {
			tenantId: this.tenantId,
			channelId,
			updateFields: Object.keys(updateData)
		});

		try {
			const db = await this.getDb();

			const result = await db.transaction(async (tx) => {
				// 1. Update channel basic data
				const channelData = {
					names: updateData.names,
					color: updateData.color,
					descriptions: updateData.descriptions,
					languages: updateData.languages,
					isPublic: updateData.isPublic,
					requiresConfirmation: updateData.requiresConfirmation
				};

				// Remove undefined values
				const cleanChannelData = Object.fromEntries(
					Object.entries(channelData).filter(([, value]) => value !== undefined)
				);

				let channel: SelectChannel;
				if (Object.keys(cleanChannelData).length > 0) {
					const channelResult = await tx
						.update(tenantSchema.channel)
						.set(cleanChannelData)
						.where(eq(tenantSchema.channel.id, channelId))
						.returning();

					if (channelResult.length === 0) {
						throw new NotFoundError(`Channel with ID ${channelId} not found`);
					}
					channel = channelResult[0];
				} else {
					// Get existing channel if no updates to basic data
					const existingChannel = await tx
						.select()
						.from(tenantSchema.channel)
						.where(eq(tenantSchema.channel.id, channelId))
						.limit(1);

					if (existingChannel.length === 0) {
						throw new NotFoundError(`Channel with ID ${channelId} not found`);
					}
					channel = existingChannel[0];
				}

				// 2. Handle agent relationships
				let agents: SelectAgent[] = [];
				if (updateData.agentIds !== undefined) {
					// Remove all existing agent assignments
					await tx
						.delete(tenantSchema.channelAgent)
						.where(eq(tenantSchema.channelAgent.channelId, channelId));

					// Add new agent assignments
					if (updateData.agentIds.length > 0) {
						// Verify agents exist
						const existingAgents = await tx
							.select()
							.from(tenantSchema.agent)
							.where(inArray(tenantSchema.agent.id, updateData.agentIds));

						if (existingAgents.length !== updateData.agentIds.length) {
							throw new ValidationError("One or more agents not found");
						}

						// Link agents to channel
						for (const agentId of updateData.agentIds) {
							await tx.insert(tenantSchema.channelAgent).values({
								channelId: channelId,
								agentId: agentId
							});
						}

						agents = existingAgents;
					}
				} else {
					// Keep existing agent assignments
					agents = await tx
						.select({
							id: tenantSchema.agent.id,
							name: tenantSchema.agent.name,
							description: tenantSchema.agent.description,
							logo: tenantSchema.agent.logo
						})
						.from(tenantSchema.agent)
						.innerJoin(
							tenantSchema.channelAgent,
							eq(tenantSchema.agent.id, tenantSchema.channelAgent.agentId)
						)
						.where(eq(tenantSchema.channelAgent.channelId, channelId));
				}

				// 3. Handle slot template relationships
				let slotTemplates: SelectSlotTemplate[] = [];
				if (updateData.slotTemplates !== undefined) {
					// Get existing slot template IDs for this channel
					const existingSlotTemplateLinks = await tx
						.select()
						.from(tenantSchema.channelSlotTemplate)
						.where(eq(tenantSchema.channelSlotTemplate.channelId, channelId));

					const existingSlotTemplateIds = existingSlotTemplateLinks.map(
						(link) => link.slotTemplateId
					);

					// Process new/updated slot templates
					const newSlotTemplateIds: string[] = [];
					for (const slotTemplateData of updateData.slotTemplates) {
						let slotTemplate: SelectSlotTemplate;

						if (slotTemplateData.id) {
							// Update existing slot template
							const updateResult = await tx
								.update(tenantSchema.slotTemplate)
								.set({
									weekdays: slotTemplateData.weekdays,
									from: slotTemplateData.from,
									to: slotTemplateData.to,
									duration: slotTemplateData.duration
								})
								.where(eq(tenantSchema.slotTemplate.id, slotTemplateData.id))
								.returning();

							if (updateResult.length === 0) {
								throw new ValidationError(`Slot template with ID ${slotTemplateData.id} not found`);
							}
							slotTemplate = updateResult[0];
							newSlotTemplateIds.push(slotTemplate.id);
						} else {
							// Create new slot template
							const createResult = await tx
								.insert(tenantSchema.slotTemplate)
								.values({
									weekdays: slotTemplateData.weekdays,
									from: slotTemplateData.from,
									to: slotTemplateData.to,
									duration: slotTemplateData.duration
								})
								.returning();

							slotTemplate = createResult[0];
							newSlotTemplateIds.push(slotTemplate.id);

							// Link new slot template to channel
							await tx.insert(tenantSchema.channelSlotTemplate).values({
								channelId: channelId,
								slotTemplateId: slotTemplate.id
							});
						}

						slotTemplates.push(slotTemplate);
					}

					// Remove slot templates that are no longer linked
					const slotTemplatesToRemove = existingSlotTemplateIds.filter(
						(id) => !newSlotTemplateIds.includes(id)
					);

					if (slotTemplatesToRemove.length > 0) {
						// Remove channel-slot template links
						await tx
							.delete(tenantSchema.channelSlotTemplate)
							.where(
								eq(tenantSchema.channelSlotTemplate.channelId, channelId) &&
									inArray(tenantSchema.channelSlotTemplate.slotTemplateId, slotTemplatesToRemove)
							);

						// Check if any of these slot templates are used by other channels
						for (const slotTemplateId of slotTemplatesToRemove) {
							const otherChannelLinks = await tx
								.select()
								.from(tenantSchema.channelSlotTemplate)
								.where(eq(tenantSchema.channelSlotTemplate.slotTemplateId, slotTemplateId))
								.limit(1);

							// Delete slot template if not used by other channels
							if (otherChannelLinks.length === 0) {
								await tx
									.delete(tenantSchema.slotTemplate)
									.where(eq(tenantSchema.slotTemplate.id, slotTemplateId));
							}
						}
					}
				} else {
					// Keep existing slot templates
					slotTemplates = await tx
						.select({
							id: tenantSchema.slotTemplate.id,
							weekdays: tenantSchema.slotTemplate.weekdays,
							from: tenantSchema.slotTemplate.from,
							to: tenantSchema.slotTemplate.to,
							duration: tenantSchema.slotTemplate.duration
						})
						.from(tenantSchema.slotTemplate)
						.innerJoin(
							tenantSchema.channelSlotTemplate,
							eq(tenantSchema.slotTemplate.id, tenantSchema.channelSlotTemplate.slotTemplateId)
						)
						.where(eq(tenantSchema.channelSlotTemplate.channelId, channelId));
				}

				return {
					...channel,
					agents,
					slotTemplates
				};
			});

			log.debug("Channel updated successfully", {
				tenantId: this.tenantId,
				channelId,
				agentCount: result.agents.length,
				slotTemplateCount: result.slotTemplates.length
			});

			return result;
		} catch (error) {
			if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
			log.error("Failed to update channel", {
				tenantId: this.tenantId,
				channelId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get a channel by ID with all relations
	 * @param channelId Channel ID
	 * @returns Channel with relations or null if not found
	 */
	async getChannelById(channelId: string): Promise<ChannelWithRelations | null> {
		const log = logger.setContext("ChannelService");
		log.debug("Getting channel by ID", { tenantId: this.tenantId, channelId });

		try {
			const db = await this.getDb();

			// Get channel
			const channelResult = await db
				.select()
				.from(tenantSchema.channel)
				.where(eq(tenantSchema.channel.id, channelId))
				.limit(1);

			if (channelResult.length === 0) {
				log.debug("Channel not found", { tenantId: this.tenantId, channelId });
				return null;
			}

			const channel = channelResult[0];

			// Get agents
			const agents = await db
				.select({
					id: tenantSchema.agent.id,
					name: tenantSchema.agent.name,
					description: tenantSchema.agent.description,
					logo: tenantSchema.agent.logo
				})
				.from(tenantSchema.agent)
				.innerJoin(
					tenantSchema.channelAgent,
					eq(tenantSchema.agent.id, tenantSchema.channelAgent.agentId)
				)
				.where(eq(tenantSchema.channelAgent.channelId, channelId));

			// Get slot templates
			const slotTemplates = await db
				.select({
					id: tenantSchema.slotTemplate.id,
					weekdays: tenantSchema.slotTemplate.weekdays,
					from: tenantSchema.slotTemplate.from,
					to: tenantSchema.slotTemplate.to,
					duration: tenantSchema.slotTemplate.duration
				})
				.from(tenantSchema.slotTemplate)
				.innerJoin(
					tenantSchema.channelSlotTemplate,
					eq(tenantSchema.slotTemplate.id, tenantSchema.channelSlotTemplate.slotTemplateId)
				)
				.where(eq(tenantSchema.channelSlotTemplate.channelId, channelId));

			const result = {
				...channel,
				agents,
				slotTemplates
			};

			log.debug("Channel found", {
				tenantId: this.tenantId,
				channelId,
				agentCount: agents.length,
				slotTemplateCount: slotTemplates.length
			});

			return result;
		} catch (error) {
			log.error("Failed to get channel by ID", {
				tenantId: this.tenantId,
				channelId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get all channels for the tenant with relations
	 * @returns Array of channels with relations
	 */
	async getAllChannels(): Promise<ChannelWithRelations[]> {
		const log = logger.setContext("ChannelService");
		log.debug("Getting all channels", { tenantId: this.tenantId });

		try {
			const db = await this.getDb();

			// Get all channels
			const channels = await db
				.select()
				.from(tenantSchema.channel)
				.orderBy(tenantSchema.channel.names);

			// Get relations for each channel
			const result: ChannelWithRelations[] = [];
			for (const channel of channels) {
				const channelWithRelations = await this.getChannelById(channel.id);
				if (channelWithRelations) {
					result.push(channelWithRelations);
				}
			}

			log.debug("Retrieved all channels", {
				tenantId: this.tenantId,
				count: result.length
			});

			return result;
		} catch (error) {
			log.error("Failed to get all channels", {
				tenantId: this.tenantId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Delete a channel with cascade cleanup
	 * @param channelId Channel ID
	 * @returns true if deleted, false if not found
	 */
	async deleteChannel(channelId: string): Promise<boolean> {
		const log = logger.setContext("ChannelService");
		log.debug("Deleting channel", { tenantId: this.tenantId, channelId });

		try {
			const db = await this.getDb();

			const result = await db.transaction(async (tx) => {
				// Get slot templates linked to this channel
				const slotTemplateLinks = await tx
					.select()
					.from(tenantSchema.channelSlotTemplate)
					.where(eq(tenantSchema.channelSlotTemplate.channelId, channelId));

				const slotTemplateIds = slotTemplateLinks.map((link) => link.slotTemplateId);

				// Remove channel-agent relationships
				await tx
					.delete(tenantSchema.channelAgent)
					.where(eq(tenantSchema.channelAgent.channelId, channelId));

				// Remove channel-slot template relationships
				await tx
					.delete(tenantSchema.channelSlotTemplate)
					.where(eq(tenantSchema.channelSlotTemplate.channelId, channelId));

				// Delete slot templates that are not used by other channels
				for (const slotTemplateId of slotTemplateIds) {
					const otherChannelLinks = await tx
						.select()
						.from(tenantSchema.channelSlotTemplate)
						.where(eq(tenantSchema.channelSlotTemplate.slotTemplateId, slotTemplateId))
						.limit(1);

					if (otherChannelLinks.length === 0) {
						await tx
							.delete(tenantSchema.slotTemplate)
							.where(eq(tenantSchema.slotTemplate.id, slotTemplateId));
					}
				}

				// Delete the channel
				const deleteResult = await tx
					.delete(tenantSchema.channel)
					.where(eq(tenantSchema.channel.id, channelId))
					.returning();

				return deleteResult.length > 0;
			});

			if (result) {
				log.debug("Channel deleted successfully", {
					tenantId: this.tenantId,
					channelId
				});
			} else {
				log.debug("Channel deletion failed: Channel not found", {
					tenantId: this.tenantId,
					channelId
				});
			}

			return result;
		} catch (error) {
			log.error("Failed to delete channel", {
				tenantId: this.tenantId,
				channelId,
				error: String(error)
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
