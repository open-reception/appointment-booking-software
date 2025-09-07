import { centralDb } from "../db";
import { tenant } from "../db/central-schema";
import { TenantMigrationService } from "./tenant-migration-service";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("StartupService");

export class StartupService {
  private static initialized = false;

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
      // Check and migrate all tenant databases
      await this.migrateTenantDatabases();

      this.initialized = true;
      logger.info("Application initialization completed successfully");
    } catch (error) {
      logger.error("Application initialization failed", { error: String(error) });
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
   * Force re-initialization (useful for testing)
   */
  static reset(): void {
    this.initialized = false;
  }

  /**
   * Check if the startup service has been initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
}
