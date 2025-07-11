import { json } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { sql } from "drizzle-orm";
import os from "os";
import { registerOpenAPIRoute } from "$lib/server/openapi";

registerOpenAPIRoute("/health/services", "GET", {
	summary: "Get service health status",
	description:
		"Returns the health status of core services including database connectivity, memory usage, and CPU load",
	tags: ["Health"],
	responses: {
		"200": {
			description: "Service health status",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/HealthStatus" },
					example: {
						core: true,
						database: true,
						memory: 2048,
						load: 0.75
					}
				}
			}
		},
		"429": {
			description: "Too Many Requests - Rate limit exceeded",
			content: {
				"text/plain": {
					schema: { type: "string" },
					example: "Too Many Requests"
				}
			}
		},
		"500": {
			description: "Internal Server Error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		}
	}
});

/**
 * Represents the health status response for core services
 */
class ServiceHealthResponse {
	/** Core service availability status */
	core: boolean = true;
	/** Database connectivity status */
	database: boolean = false;
	/** Available memory in MB */
	memory: number = 0;
	/** Current CPU load average */
	load: number = 0;
}

/**
 * GET handler for the health services endpoint
 *
 * Performs health checks on core services including:
 * - Database connectivity test
 * - System memory availability
 * - CPU load average
 *
 * @returns {Response} JSON response containing service health status
 */
export async function GET() {
	const serviceHealth = new ServiceHealthResponse();

	try {
		await db.execute(sql`SELECT 1`);
		serviceHealth.database = true;
	} catch {
		serviceHealth.database = false;
	}

	serviceHealth.memory = Math.round(os.freemem() / 1024 / 1024);

	const loadAvg = os.loadavg();
	serviceHealth.load = Math.round(loadAvg[0] * 100) / 100;

	return json(serviceHealth);
}
