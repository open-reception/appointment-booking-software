import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { join } from "path";
import { UniversalLogger } from "$lib/logger";
import { ValidationError } from "$lib/server/utils/errors";

const logger = new UniversalLogger().setContext("TenantMigrationService");

export interface TenantDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export class TenantMigrationService {
  /**
   * Create a new tenant database
   */
  static async createTenantDatabase(config: TenantDatabaseConfig): Promise<void> {
    logger.info("Creating new tenant database", { database: config.database });

    // Connect to postgres database to create the new tenant database
    const adminConnectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/postgres`;
    const adminClient = postgres(adminConnectionString);

    try {
      // Create the database
      await adminClient.unsafe(`CREATE DATABASE "${config.database}"`);
      logger.info("Tenant database created successfully", { database: config.database });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        logger.warn("Tenant database already exists", { database: config.database });
      } else {
        logger.error("Failed to create tenant database", {
          database: config.database,
          error: String(error),
        });
        throw error;
      }
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Initialize tenant database with schema
   */
  static async initializeTenantSchema(config: TenantDatabaseConfig): Promise<void> {
    logger.info("Initializing tenant database schema", { database: config.database });

    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    const client = postgres(connectionString);

    try {
      // Create drizzle instance for this tenant database
      const db = drizzle(client);

      // Get the path to tenant migrations
      const migrationsPath = join(process.cwd(), "tenant-migrations");

      // Apply migrations
      await migrate(db, { migrationsFolder: migrationsPath });

      logger.info("Tenant database schema initialized successfully", { database: config.database });
    } catch (error) {
      logger.error("Failed to initialize tenant database schema", {
        database: config.database,
        error: String(error),
      });
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Check if tenant database exists
   */
  static async tenantDatabaseExists(config: TenantDatabaseConfig): Promise<boolean> {
    const adminConnectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/postgres`;
    const adminClient = postgres(adminConnectionString);

    try {
      const result = await adminClient`
				SELECT 1 FROM pg_database WHERE datname = ${config.database}
			`;
      return result.length > 0;
    } catch (error) {
      logger.error("Failed to check tenant database existence", {
        database: config.database,
        error: String(error),
      });
      return false;
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Check if migrations table exists in tenant database
   */
  static async migrationTableExists(config: TenantDatabaseConfig): Promise<boolean> {
    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    const client = postgres(connectionString);

    try {
      const tableExists = await client`
				SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_schema = 'public'
					AND table_name = '__drizzle_migrations'
				);
			`;

      return tableExists[0].exists;
    } catch (error) {
      logger.error("Failed to check migrations table existence", {
        database: config.database,
        error: String(error),
      });
      return false;
    } finally {
      await client.end();
    }
  }

  /**
   * Apply pending migrations to a tenant database
   */
  static async migrateTenantDatabase(config: TenantDatabaseConfig): Promise<void> {
    logger.info("Migrating tenant database", { database: config.database });

    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    const client = postgres(connectionString);

    try {
      const db = drizzle(client);
      const migrationsPath = join(process.cwd(), "tenant-migrations");

      await migrate(db, { migrationsFolder: migrationsPath });

      logger.info("Tenant database migrated successfully", { database: config.database });
    } catch (error) {
      logger.error("Failed to migrate tenant database", {
        database: config.database,
        error: String(error),
      });
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Create tenant database configuration from database URL
   */
  static parseDatabaseUrl(databaseUrl: string): TenantDatabaseConfig {
    try {
      const url = new URL(databaseUrl);

      return {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1), // Remove leading slash
        username: url.username,
        password: url.password,
      };
    } catch {
      throw new ValidationError(`Invalid database URL: ${databaseUrl}`);
    }
  }

  /**
   * Create a complete tenant database with schema
   */
  static async createAndInitializeTenantDatabase(databaseUrl: string): Promise<void> {
    const config = this.parseDatabaseUrl(databaseUrl);

    // Create the database
    await this.createTenantDatabase(config);

    // Initialize the schema
    await this.initializeTenantSchema(config);

    logger.info("Tenant database created and initialized", {
      database: config.database,
      host: config.host,
      port: config.port,
    });
  }

  /**
   * Ensure tenant database is up to date
   */
  static async ensureTenantDatabaseUpToDate(databaseUrl: string): Promise<void> {
    const config = this.parseDatabaseUrl(databaseUrl);

    logger.info("Checking tenant database status", { database: config.database });

    // Check if database exists
    const exists = await this.tenantDatabaseExists(config);
    if (!exists) {
      logger.info("Tenant database does not exist, creating...", { database: config.database });
      await this.createAndInitializeTenantDatabase(databaseUrl);
      return;
    }

    logger.info("Tenant database exists, checking for pending migrations", {
      database: config.database,
    });

    // Check if migrations table exists to determine if we need to run migrations
    const hasSchema = await this.migrationTableExists(config);
    if (!hasSchema) {
      logger.info("No migrations table found, applying migrations...", {
        database: config.database,
      });
      await this.migrateTenantDatabase(config);
    } else {
      logger.info("Checking for pending migrations...", { database: config.database });
      // Always run migrate - it's idempotent and will apply only pending migrations
      await this.migrateTenantDatabase(config);
    }
  }
}
