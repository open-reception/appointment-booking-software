import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { join } from "path";
import { UniversalLogger } from "$lib/logger";
import { ValidationError } from "$lib/server/utils/errors";
import { env } from "$env/dynamic/private";

const logger = new UniversalLogger().setContext("CentralDatabaseMigrationService");

export interface CentralDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export class CentralDatabaseMigrationService {
  /**
   * Create a new database
   */
  private static async createCentralDatabase(config: CentralDatabaseConfig): Promise<void> {
    logger.info("Creating central database", { database: config.database });

    // Connect to postgres database to create the new central database
    const adminConnectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/postgres`;
    const adminClient = postgres(adminConnectionString);

    try {
      // Create the database
      await adminClient.unsafe(`CREATE DATABASE "${config.database}"`);
      logger.info("Central database created successfully", { database: config.database });
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        logger.warn("Central database already exists", { database: config.database });
      } else {
        logger.error("Failed to create central database", {
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
   * Initialize central database with schema
   */
  private static async initializeCentralSchema(config: CentralDatabaseConfig): Promise<void> {
    logger.info("Initializing central database schema", { database: config.database });

    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    const client = postgres(connectionString);

    try {
      // Create drizzle instance for the central database
      const db = drizzle(client);

      // Get the path to central migrations
      const migrationsPath = join(process.cwd(), "migrations");

      // Apply migrations
      await migrate(db, { migrationsFolder: migrationsPath });

      logger.info("Central database schema initialized successfully", {
        database: config.database,
      });
    } catch (error) {
      logger.error("Failed to initialize central database schema", {
        database: config.database,
        error: String(error),
      });
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Check if central database exists
   */
  private static async centralDatabaseExists(config: CentralDatabaseConfig): Promise<boolean> {
    const adminConnectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/postgres`;
    const adminClient = postgres(adminConnectionString);

    try {
      const result = await adminClient`
				SELECT 1 FROM pg_database WHERE datname = ${config.database}
			`;
      return result.length > 0;
    } catch (error) {
      logger.error("Failed to check central database existence", {
        database: config.database,
        error: String(error),
      });
      return false;
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Check if migrations table exists in central database
   */
  private static async migrationTableExists(config: CentralDatabaseConfig): Promise<boolean> {
    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    const client = postgres(connectionString);

    try {
      const tableExists = await client`
				SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_schema = 'drizzle'
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
   * Apply pending migrations to the central database
   */
  private static async migrateCentralDatabase(config: CentralDatabaseConfig): Promise<void> {
    logger.info("Migrating central database", { database: config.database });

    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    const client = postgres(connectionString);

    try {
      const db = drizzle(client);
      const migrationsPath = join(process.cwd(), "migrations");

      await migrate(db, { migrationsFolder: migrationsPath });

      logger.info("Central database migrated successfully", { database: config.database });
    } catch (error) {
      logger.error("Failed to migrate central database", {
        database: config.database,
        error: String(error),
      });
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Create central database configuration from DATABASE_URL environment variable
   */
  private static parseCentralDatabaseUrl(): CentralDatabaseConfig {
    if (!env.DATABASE_URL) {
      throw new ValidationError("DATABASE_URL environment variable is not set");
    }

    try {
      const url = new URL(env.DATABASE_URL);

      return {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1), // Remove leading slash
        username: url.username,
        password: url.password,
      };
    } catch {
      throw new ValidationError(`Invalid DATABASE_URL: ${env.DATABASE_URL}`);
    }
  }

  /**
   * Create a complete central database with schema
   */
  private static async createAndInitializeCentralDatabase(): Promise<void> {
    const config = this.parseCentralDatabaseUrl();

    // Create the database
    await this.createCentralDatabase(config);

    // Initialize the schema
    await this.initializeCentralSchema(config);

    logger.info("Central database created and initialized", {
      database: config.database,
      host: config.host,
      port: config.port,
    });
  }

  /**
   * Ensure central database is up to date
   */
  static async ensureCentralDatabaseUpToDate(): Promise<void> {
    const config = this.parseCentralDatabaseUrl();

    logger.info("Checking central database status", { database: config.database });

    // Check if database exists
    const exists = await this.centralDatabaseExists(config);
    if (!exists) {
      logger.info("Central database does not exist, creating...", { database: config.database });
      await this.createAndInitializeCentralDatabase();
      return;
    }

    logger.info("Central database exists, checking for pending migrations", {
      database: config.database,
    });

    // Check if migrations table exists to determine if we need to run migrations
    const hasSchema = await this.migrationTableExists(config);
    if (!hasSchema) {
      logger.info("No migrations table found, applying migrations...", { database: config.database });
      await this.migrateCentralDatabase(config);
    } else {
      logger.info("Checking for pending migrations...", { database: config.database });
      // Always run migrate - it's idempotent and will apply only pending migrations
      await this.migrateCentralDatabase(config);
    }
  }
}
