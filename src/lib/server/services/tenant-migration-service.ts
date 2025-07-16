import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { existsSync, readFileSync } from "fs";
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
					error: String(error)
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
				error: String(error)
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
				error: String(error)
			});
			return false;
		} finally {
			await adminClient.end();
		}
	}

	/**
	 * Get current schema version for a tenant database
	 */
	static async getTenantSchemaVersion(config: TenantDatabaseConfig): Promise<string | null> {
		const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
		const client = postgres(connectionString);

		try {
			// Check if migrations table exists
			const tableExists = await client`
				SELECT EXISTS (
					SELECT FROM information_schema.tables 
					WHERE table_schema = 'public' 
					AND table_name = '__drizzle_migrations'
				);
			`;

			if (!tableExists[0].exists) {
				return null;
			}

			// Get the latest migration
			const result = await client`
				SELECT hash FROM __drizzle_migrations 
				ORDER BY created_at DESC 
				LIMIT 1
			`;

			return result.length > 0 ? result[0].hash : null;
		} catch (error) {
			logger.error("Failed to get tenant schema version", {
				database: config.database,
				error: String(error)
			});
			return null;
		} finally {
			await client.end();
		}
	}

	/**
	 * Get the latest available migration hash
	 */
	static getLatestMigrationHash(): string | null {
		try {
			const migrationsPath = join(process.cwd(), "tenant-migrations");
			const metaPath = join(migrationsPath, "meta", "_journal.json");

			if (!existsSync(metaPath)) {
				return null;
			}

			const journal = JSON.parse(readFileSync(metaPath, "utf-8"));
			const entries = journal.entries || [];

			if (entries.length === 0) {
				return null;
			}

			// Get the latest entry
			const latestEntry = entries[entries.length - 1];
			return latestEntry.hash || null;
		} catch (error) {
			logger.error("Failed to get latest migration hash", { error: String(error) });
			return null;
		}
	}

	/**
	 * Check if tenant database needs migration
	 */
	static async tenantNeedsMigration(config: TenantDatabaseConfig): Promise<boolean> {
		const currentVersion = await this.getTenantSchemaVersion(config);
		const latestVersion = this.getLatestMigrationHash();

		if (!latestVersion) {
			return false; // No migrations available
		}

		if (!currentVersion) {
			return true; // Database has no schema yet
		}

		return currentVersion !== latestVersion;
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
				error: String(error)
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
				password: url.password
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
			port: config.port
		});
	}

	/**
	 * Ensure tenant database is up to date
	 */
	static async ensureTenantDatabaseUpToDate(databaseUrl: string): Promise<void> {
		const config = this.parseDatabaseUrl(databaseUrl);

		// Check if database exists
		const exists = await this.tenantDatabaseExists(config);
		if (!exists) {
			await this.createAndInitializeTenantDatabase(databaseUrl);
			return;
		}

		// Check if migration is needed
		const needsMigration = await this.tenantNeedsMigration(config);
		if (needsMigration) {
			await this.migrateTenantDatabase(config);
		}

		logger.debug("Tenant database is up to date", { database: config.database });
	}
}
