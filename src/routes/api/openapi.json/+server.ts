import { json } from '@sveltejs/kit';
import { generateOpenApiSpec } from '$lib/server/openapi.js';

// ATTENTION: All routes need to be imported here to make sure they're added to the OpenAPI spec
import '../health/services/+server.js';

export async function GET() {
    const spec = generateOpenApiSpec();
    return json(spec);
}