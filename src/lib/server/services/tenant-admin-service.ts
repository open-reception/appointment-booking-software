import { centralDb, getTenantDb } from "../db";
import * as centralSchema from "../db/central-schema";
import { type InsertTenant } from "../db/central-schema";
import { TenantConfig } from "../db/tenant-config";
import { TenantMigrationService } from "./tenant-migration-service";

import { env } from "$env/dynamic/private";
import { eq, and, not } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";
import { sendTenantAdminInviteEmail } from "../email/email-service";
import { ERRORS } from "$lib/errors";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const tenantCreationSchema = z.object({
  shortName: z
    .string()
    .min(4)
    .max(15)
    .regex(/^[a-z][a-z-]*[a-z]$/),
  inviteAdmin: z.email().optional(),
});

export type TenantCreationRequest = z.infer<typeof tenantCreationSchema>;

export interface TenantConfiguration extends Record<string, string | number | boolean> {
  brandColor: string;
  defaultLanguage: string;
  maxChannels: number;
  maxTeamMembers: number;
  autoDeleteDays: number;
  requireEmail: boolean;
  requirePhone: boolean;
  nextChannelColor: number;
  website: string;
  imprint: string;
  privacyStatement: string;
}

export class TenantAdminService {
  #config!: TenantConfig;
  #tenant: Awaited<centralSchema.SelectTenant> | null = null;
  #db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

  private constructor(public readonly tenantId: string) {}

  static getConfigDefaults(): TenantConfiguration {
    return {
      brandColor: "#E11E15",
      defaultLanguage: "DE",
      maxChannels: -1,
      maxTeamMembers: -1,
      autoDeleteDays: 30,
      requireEmail: true,
      requirePhone: false,
      nextChannelColor: 0,
      website: "",
      imprint: "",
      privacyStatement: "",
    };
  }

  static async createTenant(request: TenantCreationRequest) {
    const log = logger.setContext("TenantAdminService");

    const validation = tenantCreationSchema.safeParse(request);

    if (!validation.success) throw new ValidationError("Invalid tenant creation request");

    log.debug("Creating new tenant", {
      shortName: request.shortName,
    });

    // Check if tenant can be created without any duplications. Do not create tenant if:
    // - short name already exists
    // - invited tenant admin email already exists
    const tenantExists = await centralDb
      .select()
      .from(centralSchema.tenant)
      .where(eq(centralSchema.tenant.shortName, request.shortName));
    if (tenantExists.length > 0) {
      throw new ConflictError("Tenant with shortname already exists");
    }
    if (request.inviteAdmin) {
      const adminExists = await centralDb
        .select()
        .from(centralSchema.user)
        .where(eq(centralSchema.user.email, request.inviteAdmin));
      if (adminExists.length > 0) {
        throw new ConflictError(ERRORS.USERS.EMAIL_EXISTS);
      }
    }

    const configuration = TenantAdminService.getConfigDefaults();

    const urlParts = env.DATABASE_URL?.split("/") ?? [];
    urlParts.pop();

    const newTenant: InsertTenant = { ...request, longName: "", databaseUrl: "" };
    newTenant.databaseUrl = urlParts.join("/") + "/" + newTenant.shortName;

    try {
      const tenant = await centralDb.insert(centralSchema.tenant).values(newTenant).returning();

      log.debug("Tenant created in database", {
        tenantId: tenant[0].id,
        shortName: newTenant.shortName,
      });

      // Initialize tenant database with schema
      try {
        await TenantMigrationService.createAndInitializeTenantDatabase(newTenant.databaseUrl);
        log.debug("Tenant database initialized successfully", {
          tenantId: tenant[0].id,
          databaseUrl: newTenant.databaseUrl,
        });
      } catch (dbError) {
        log.error("Failed to initialize tenant database", {
          tenantId: tenant[0].id,
          databaseUrl: newTenant.databaseUrl,
          error: String(dbError),
        });

        // Clean up the tenant record if database initialization fails
        await centralDb
          .delete(centralSchema.tenant)
          .where(eq(centralSchema.tenant.id, tenant[0].id));
        throw new Error(`Failed to initialize tenant database: ${String(dbError)}`);
      }

      const config = await TenantConfig.create(tenant[0].id);
      for (const [key, value] of Object.entries(configuration)) {
        config.setConfig(key, value);
      }

      log.debug("Tenant configuration initialized", {
        tenantId: tenant[0].id,
        configCount: Object.keys(configuration).length,
      });

      const tenantService = new TenantAdminService(tenant[0].id);
      tenantService.#config = config;
      tenantService.#tenant = tenant[0];

      log.debug("Tenant service created successfully", { tenantId: tenant[0].id });

      // Send tenant admin invitation email if email is provided
      if (request.inviteAdmin) {
        try {
          // For now, we'll use the email as name. In a real implementation,
          // you might want to collect the name separately or parse it from the email
          const adminName = request.inviteAdmin.split("@")[0];

          // Generate registration URL for the tenant admin
          // This should point to a registration page that pre-fills tenant info
          const registrationUrl = `${env.PUBLIC_APP_URL || "http://localhost:5173"}/register?tenant=${tenant[0].id}&email=${encodeURIComponent(request.inviteAdmin)}&role=TENANT_ADMIN`;

          await sendTenantAdminInviteEmail(
            request.inviteAdmin,
            adminName,
            tenant[0],
            registrationUrl,
          );

          log.info("Tenant admin invitation email sent successfully", {
            tenantId: tenant[0].id,
            adminEmail: request.inviteAdmin,
          });
        } catch (emailError) {
          log.error("Failed to send tenant admin invitation email", {
            tenantId: tenant[0].id,
            adminEmail: request.inviteAdmin,
            error: String(emailError),
          });

          // Don't fail the tenant creation if email fails
          // Just log the error and continue
        }
      }

      return tenantService;
    } catch (error) {
      log.error("Failed to create tenant", {
        shortName: newTenant.shortName,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Create a tenant admin service by its ID
   * @param id
   * @returns new TenantAdminService
   */
  static async getTenantById(id: string) {
    const log = logger.setContext("TenantAdminService");
    log.debug("Getting tenant by ID", { tenantId: id });

    try {
      const tenant = new TenantAdminService(id);
      tenant.#config = await TenantConfig.create(id);
      const data = await tenant.#db
        ?.select()
        .from(centralSchema.tenant)
        .where(eq(centralSchema.tenant.id, id))
        .limit(1);
      if (data) {
        tenant.#tenant = data[0];
      }

      log.debug("Tenant service loaded successfully", { tenantId: id });
      return tenant;
    } catch (error) {
      log.error("Failed to get tenant by ID", { tenantId: id, error: String(error) });
      throw error;
    }
  }

  /**
   * Access the tenants configuration
   */
  get configuration() {
    return this.#config;
  }

  get tenantData() {
    return this.#tenant;
  }

  /**
   * Update tenant data (longName, shortName, description, logo)
   */
  async updateTenantData(
    updateData: Partial<Pick<InsertTenant, "longName" | "shortName" | "description" | "logo">>,
  ) {
    const log = logger.setContext("TenantAdminService");
    log.debug("Updating tenant data", {
      tenantId: this.tenantId,
      updateFields: Object.keys(updateData),
    });

    if (updateData.shortName) {
      const shortNameValidation = tenantCreationSchema.shape.shortName.safeParse(
        updateData.shortName,
      );
      if (!shortNameValidation.success) {
        throw new ValidationError("Invalid shortName format");
      }
    }

    try {
      const result = await centralDb
        .update(centralSchema.tenant)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(centralSchema.tenant.id, this.tenantId))
        .returning();

      if (!result[0]) {
        log.warn("Tenant update failed: Tenant not found", { tenantId: this.tenantId });
        throw new NotFoundError(`Tenant with ID ${this.tenantId} not found`);
      }

      log.debug("Tenant data updated successfully", {
        tenantId: this.tenantId,
        updateFields: Object.keys(updateData),
      });

      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("Failed to update tenant data", {
        tenantId: this.tenantId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Update tenant configuration entries using TenantConfig
   */
  async updateTenantConfig(configUpdates: Record<string, boolean | number | string>) {
    const log = logger.setContext("TenantAdminService");
    log.debug("Updating tenant configuration", {
      tenantId: this.tenantId,
      configKeys: Object.keys(configUpdates),
    });

    try {
      const results = [];

      for (const [key, value] of Object.entries(configUpdates)) {
        await this.#config.setConfig(key, value);
        results.push({ key, value });
      }

      log.debug("Tenant configuration updated successfully", {
        tenantId: this.tenantId,
        configKeys: Object.keys(configUpdates),
        updatedCount: results.length,
      });

      return results;
    } catch (error) {
      log.error("Failed to update tenant configuration", {
        tenantId: this.tenantId,
        configKeys: Object.keys(configUpdates),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Set the setup state of the tenant
   */
  async setSetupState(
    setupState: "NEW" | "SETTINGS_CREATED" | "AGENTS_SET_UP" | "FIRST_CHANNEL_CREATED",
  ) {
    const log = logger.setContext("TenantAdminService");
    log.debug("Setting tenant setup state", {
      tenantId: this.tenantId,
      setupState,
    });

    try {
      const result = await centralDb
        .update(centralSchema.tenant)
        .set({
          setupState,
          updatedAt: new Date(),
        })
        .where(eq(centralSchema.tenant.id, this.tenantId))
        .returning();

      if (!result[0]) {
        log.warn("Tenant setup state update failed: Tenant not found", { tenantId: this.tenantId });
        throw new NotFoundError(`Tenant with ID ${this.tenantId} not found`);
      }

      this.#tenant = result[0];

      log.debug("Tenant setup state updated successfully", {
        tenantId: this.tenantId,
        setupState,
      });

      return result[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("Failed to set tenant setup state", {
        tenantId: this.tenantId,
        setupState,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get the tenant's database connection (cached)
   */
  async getDb() {
    const log = logger.setContext("TenantAdminService");

    if (!this.#db) {
      log.debug("Creating new tenant database connection", { tenantId: this.tenantId });
      try {
        this.#db = await getTenantDb(this.tenantId);
        log.debug("Tenant database connection established", { tenantId: this.tenantId });
      } catch (error) {
        log.error("Failed to establish tenant database connection", {
          tenantId: this.tenantId,
          error: String(error),
        });
        throw error;
      }
    } else {
      log.debug("Using cached tenant database connection", { tenantId: this.tenantId });
    }

    return this.#db;
  }

  /**
   * Delete a tenant and all associated data
   * This operation:
   * - Drops the tenant's isolated database
   * - Deletes all non-global-admin users associated with the tenant
   * - Removes tenant assignment from global admins (sets tenantId to null)
   * - Removes the tenant record from the central database
   * - Cleans up tenant configuration entries
   *
   * @throws {NotFoundError} If the tenant doesn't exist
   * @throws {Error} If database operations fail
   */
  async deleteTenant() {
    const log = logger.setContext("TenantAdminService");
    log.info("Starting tenant deletion process", { tenantId: this.tenantId });

    // First, get tenant data to ensure it exists
    if (!this.#tenant) {
      const tenantData = await centralDb
        .select()
        .from(centralSchema.tenant)
        .where(eq(centralSchema.tenant.id, this.tenantId))
        .limit(1);

      if (!tenantData[0]) {
        log.warn("Tenant deletion failed: Tenant not found", { tenantId: this.tenantId });
        throw new NotFoundError(`Tenant with ID ${this.tenantId} not found`);
      }

      this.#tenant = tenantData[0];
    }

    const tenantDbUrl = this.#tenant.databaseUrl;
    const tenantShortName = this.#tenant.shortName;

    try {
      // Step 1: Handle users associated with this tenant
      log.debug("Processing tenant users", { tenantId: this.tenantId });

      // First, remove tenant assignment from global admins (they must not be deleted)
      const updatedGlobalAdmins = await centralDb
        .update(centralSchema.user)
        .set({
          tenantId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(centralSchema.user.tenantId, this.tenantId),
            eq(centralSchema.user.role, "GLOBAL_ADMIN"),
          ),
        )
        .returning({
          id: centralSchema.user.id,
          email: centralSchema.user.email,
          role: centralSchema.user.role,
        });

      log.info("Removed tenant assignment from global admins", {
        tenantId: this.tenantId,
        updatedCount: updatedGlobalAdmins.length,
        updatedAdmins: updatedGlobalAdmins.map((u) => ({ id: u.id, email: u.email, role: u.role })),
      });

      // Then, delete non-global-admin users (TENANT_ADMIN, STAFF)
      const deletedUsers = await centralDb
        .delete(centralSchema.user)
        .where(
          and(
            eq(centralSchema.user.tenantId, this.tenantId),
            not(eq(centralSchema.user.role, "GLOBAL_ADMIN")),
          ),
        )
        .returning({
          id: centralSchema.user.id,
          email: centralSchema.user.email,
          role: centralSchema.user.role,
        });

      log.info("Deleted non-global-admin tenant users", {
        tenantId: this.tenantId,
        deletedCount: deletedUsers.length,
        deletedUsers: deletedUsers.map((u) => ({ id: u.id, email: u.email, role: u.role })),
      });

      // Step 2: Delete tenant configuration entries
      log.debug("Deleting tenant configuration entries", { tenantId: this.tenantId });

      const deletedConfigs = await centralDb
        .delete(centralSchema.tenantConfig)
        .where(eq(centralSchema.tenantConfig.tenantId, this.tenantId))
        .returning({ id: centralSchema.tenantConfig.id, name: centralSchema.tenantConfig.name });

      log.info("Deleted tenant configuration entries", {
        tenantId: this.tenantId,
        deletedCount: deletedConfigs.length,
      });

      // Step 3: Drop the tenant database
      log.debug("Dropping tenant database", {
        tenantId: this.tenantId,
        databaseUrl: tenantDbUrl,
        shortName: tenantShortName,
      });

      try {
        const dbConfig = TenantMigrationService.parseDatabaseUrl(tenantDbUrl);
        const adminConnectionString = `postgres://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/postgres`;

        // Import postgres here to avoid top-level import issues
        const { default: postgres } = await import("postgres");
        const adminClient = postgres(adminConnectionString);

        try {
          // Terminate all connections to the database first
          await adminClient.unsafe(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = '${dbConfig.database}'
              AND pid <> pg_backend_pid()
          `);

          // Drop the database
          await adminClient.unsafe(`DROP DATABASE IF EXISTS "${dbConfig.database}"`);

          log.info("Tenant database dropped successfully", {
            tenantId: this.tenantId,
            database: dbConfig.database,
          });
        } finally {
          await adminClient.end();
        }
      } catch (dbError) {
        log.error("Failed to drop tenant database", {
          tenantId: this.tenantId,
          databaseUrl: tenantDbUrl,
          error: String(dbError),
        });
        // Continue with tenant record deletion even if database drop fails
        // This allows cleanup of orphaned tenant records
      }

      // Step 4: Delete the tenant record from central database
      log.debug("Deleting tenant record from central database", { tenantId: this.tenantId });

      const deletedTenant = await centralDb
        .delete(centralSchema.tenant)
        .where(eq(centralSchema.tenant.id, this.tenantId))
        .returning();

      if (!deletedTenant[0]) {
        log.error("Failed to delete tenant record: Tenant not found", { tenantId: this.tenantId });
        throw new NotFoundError(`Tenant with ID ${this.tenantId} not found`);
      }

      log.info("Tenant deletion completed successfully", {
        tenantId: this.tenantId,
        shortName: tenantShortName,
        deletedUsersCount: deletedUsers.length,
        updatedGlobalAdminsCount: updatedGlobalAdmins.length,
        deletedConfigsCount: deletedConfigs.length,
      });

      // Clear cached data
      this.#tenant = null;
      this.#db = null;

      return {
        tenantId: this.tenantId,
        shortName: tenantShortName,
        deletedUsersCount: deletedUsers.length,
        updatedGlobalAdminsCount: updatedGlobalAdmins.length,
        deletedConfigsCount: deletedConfigs.length,
        deletedUsers: deletedUsers.map((u) => ({ id: u.id, email: u.email, role: u.role })),
        updatedGlobalAdmins: updatedGlobalAdmins.map((u) => ({
          id: u.id,
          email: u.email,
          role: u.role,
        })),
      };
    } catch (error) {
      log.error("Tenant deletion failed", {
        tenantId: this.tenantId,
        shortName: tenantShortName,
        error: String(error),
      });
      throw error;
    }
  }
}
