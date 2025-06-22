export type JsonSchema = {
	type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	required?: string[];
	format?: string;
	description?: string;
	example?: unknown;
	enum?: unknown[];
	$ref?: string;
};

export interface OpenApiResponse {
	description: string;
	content?: Record<string, {
		schema: JsonSchema;
		example?: unknown;
	}>;
}

export interface OpenApiParameter {
	name: string;
	in: 'query' | 'path' | 'header';
	description?: string;
	required?: boolean;
	schema: JsonSchema;
}

export interface OpenApiRequestBody {
	description?: string;
	content: Record<string, {
		schema: JsonSchema;
		example?: unknown;
	}>;
}

export interface OpenApiOperation {
	summary?: string;
	description?: string;
	tags?: string[];
	responses?: Record<string, OpenApiResponse>;
	parameters?: OpenApiParameter[];
	requestBody?: OpenApiRequestBody;
}

const apiOperationsRegistry = new Map<string, OpenApiOperation>();

export function registerOpenAPIRoute(path: string, method: string, operation: OpenApiOperation) {
	const key = `${method.toUpperCase()} ${path}`;
	apiOperationsRegistry.set(key, operation);
}

export function getApiOperations(): Map<string, OpenApiOperation> {
	return apiOperationsRegistry;
}

export function generateOpenApiSpec() {
	const paths: Record<string, Record<string, OpenApiOperation>> = {};
	
	// Convert registered operations to OpenAPI paths
	for (const [key, operation] of apiOperationsRegistry.entries()) {
		const [method, path] = key.split(' ', 2);
		if (!paths[path]) {
			paths[path] = {};
		}
		paths[path][method.toLowerCase()] = operation;
	}
	
	return {
		openapi: '3.0.0',
		info: {
			title: 'Open Reception API',
			description: 'End-to-end encrypted appointment booking platform',
			version: '0.0.1',
			license: {
				name: 'AGPL-3.0',
				url: 'https://www.gnu.org/licenses/agpl-3.0.html'
			}
		},
		servers: [
			{
				url: '/api',
				description: 'API Server'
			}
		],
		paths,
		components: {
			schemas: {
				Error: {
					type: 'object',
					properties: {
						error: { type: 'string', description: 'Error message' },
						code: { type: 'string', description: 'Error code' }
					},
					required: ['error']
				},
				HealthStatus: {
					type: 'object',
					properties: {
						core: { type: 'boolean', description: 'Core service status' },
						database: { type: 'boolean', description: 'Database connectivity status' },
						memory: { type: 'integer', description: 'Free memory in megabytes' },
						load: { type: 'number', format: 'float', description: 'Average CPU load' }
					},
					required: ['core', 'database', 'memory', 'load']
				}
			}
		},
		tags: [
			{ name: 'Health', description: 'Health check and monitoring endpoints' },
			{ name: 'Appointments', description: 'Appointment management endpoints' },
			{ name: 'Clients', description: 'Client management endpoints' },
			{ name: 'Channels', description: 'Channel management endpoints' },
			{ name: 'Questionnaires', description: 'Questionnaire management endpoints' }
		]
	};
}