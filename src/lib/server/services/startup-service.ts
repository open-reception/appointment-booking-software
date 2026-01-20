import { centralDb } from "../db";
import { tenant } from "../db/central-schema";
import { TenantMigrationService } from "./tenant-migration-service";
import { CentralDatabaseMigrationService } from "./central-database-migration-service";
import { InviteService } from "./invite-service";
import { SessionService } from "../auth/session-service";
import { ClientPinResetService } from "./client-pin-reset-service";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("StartupService");
const TWELVE_HOURS_IN_MS = 12 * 60 * 60 * 1000;
export class StartupService {
  private static initialized = false;
  private static housekeepingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the application on startup
   * This should be called once when the application starts
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug("StartupService already initialized, skipping");
      return;
    }

    logger.info("Starting application initialization");

    try {
      // First ensure central database is up to date
      await this.ensureCentralDatabase();

      // Then check and migrate all tenant databases
      await this.migrateTenantDatabases();

      // Start automatic housekeeping
      this.startAutomaticHousekeeping();

      this.initialized = true;
      logger.info("Application initialization completed successfully");
    } catch (error) {
      logger.error("Application initialization failed", { error: String(error) });
      throw error;
    }
  }

  /**
   * Ensure central database exists and is up to date
   */
  private static async ensureCentralDatabase(): Promise<void> {
    logger.info("Ensuring central database is up to date");

    try {
      await CentralDatabaseMigrationService.ensureCentralDatabaseUpToDate();
      logger.info("Central database is ready");
    } catch (error) {
      logger.error("Failed to setup central database", { error: String(error) });
      throw error;
    }
  }

  /**
   * Check and migrate all tenant databases
   */
  private static async migrateTenantDatabases(): Promise<void> {
    logger.info("Checking tenant database migrations");

    try {
      // Get all tenants from central database
      const tenants = await centralDb
        .select({
          id: tenant.id,
          shortName: tenant.shortName,
          databaseUrl: tenant.databaseUrl,
        })
        .from(tenant);

      if (tenants.length === 0) {
        logger.info("No tenants found, skipping tenant database migrations");
        return;
      }

      logger.info(`Found ${tenants.length} tenants, checking migrations`);

      // Process tenants in parallel (but with concurrency limit)
      const migrationPromises = tenants.map(async (tenantData) => {
        try {
          logger.debug("Checking tenant database migration", {
            tenantId: tenantData.id,
            shortName: tenantData.shortName,
          });

          await TenantMigrationService.ensureTenantDatabaseUpToDate(tenantData.databaseUrl);

          logger.debug("Tenant database migration completed", {
            tenantId: tenantData.id,
            shortName: tenantData.shortName,
          });
        } catch (error) {
          logger.error("Failed to migrate tenant database", {
            tenantId: tenantData.id,
            shortName: tenantData.shortName,
            databaseUrl: tenantData.databaseUrl,
            error: String(error),
          });

          // Don't throw here - we want to continue with other tenants
          // In production, you might want to implement retry logic or alerts
        }
      });

      // Wait for all migrations to complete
      await Promise.all(migrationPromises);

      logger.info("All tenant database migrations completed");
    } catch (error) {
      logger.error("Failed to migrate tenant databases", { error: String(error) });
      throw error;
    }
  }

  /**
   * Start automatic housekeeping that runs twice daily
   * Runs immediately on startup, then every 12 hours
   */
  private static startAutomaticHousekeeping(): void {
    logger.info("Starting automatic housekeeping scheduler");

    // Run housekeeping immediately on startup
    this.performHousekeeping().catch((error) => {
      logger.error("Initial housekeeping failed", { error: String(error) });
    });

    // Schedule housekeeping to run every 12 hours
    if (this.housekeepingInterval) {
      clearInterval(this.housekeepingInterval);
    }
    this.housekeepingInterval = setInterval(() => {
      logger.info("Scheduled housekeeping triggered");
      this.performHousekeeping().catch((error) => {
        logger.error("Scheduled housekeeping failed", { error: String(error) });
      });
    }, TWELVE_HOURS_IN_MS); // 12 hours in milliseconds

    logger.info("Automatic housekeeping scheduler started (runs every 12 hours)");
  }

  /**
   * Perform housekeeping tasks across all tenants
   * Cleans up expired invitations, sessions, and PIN reset tokens
   */
  static async performHousekeeping(): Promise<void> {
    logger.info("Starting housekeeping tasks");

    try {
      // Cleanup expired invitations (central database)
      const deletedInvites = await InviteService.cleanupExpiredInvites();
      logger.info(`Cleaned up ${deletedInvites} expired invitations`);

      // Cleanup expired sessions (central database)
      await SessionService.cleanupExpiredSessions();
      logger.info("Cleaned up expired sessions");

      // Get all tenants
      const tenants = await centralDb
        .select({
          id: tenant.id,
          shortName: tenant.shortName,
        })
        .from(tenant);

      // Cleanup expired PIN reset tokens for each tenant
      for (const tenantData of tenants) {
        try {
          const pinResetService = await ClientPinResetService.forTenant(tenantData.id);
          const deletedTokens = await pinResetService.cleanupExpiredTokens();
          logger.info(`Cleaned up ${deletedTokens} expired PIN reset tokens for tenant`, {
            tenantId: tenantData.id,
            shortName: tenantData.shortName,
          });
        } catch (error) {
          logger.error("Failed to cleanup PIN reset tokens for tenant", {
            tenantId: tenantData.id,
            shortName: tenantData.shortName,
            error: String(error),
          });
          // Continue with other tenants
        }
      }

      logger.info("Housekeeping tasks completed successfully");
    } catch (error) {
      logger.error("Housekeeping tasks failed", { error: String(error) });
      throw error;
    }
  }

  /**
   * Force re-initialization (useful for testing)
   */
  static reset(): void {
    // Clear the housekeeping interval if it exists
    if (this.housekeepingInterval) {
      clearInterval(this.housekeepingInterval);
      this.housekeepingInterval = null;
      logger.debug("Housekeeping interval cleared");
    }
    this.initialized = false;
  }

  /**
   * Check if the startup service has been initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
}
