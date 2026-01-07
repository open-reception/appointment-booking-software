import { json } from "@sveltejs/kit";
import { generateOpenApiSpec } from "$lib/server/openapi.js";

// ATTENTION: All routes need to be imported here to make sure they're added to the OpenAPI spec

// Health routes
import "../health/services/+server.js";

// Auth routes
import "../auth/challenge/+server.js";
import "../auth/login/+server.js";
import "../auth/passkeys/+server.js";
import "../auth/passkeys/[passkeyId]/+server.js";
import "../auth/passkeys/[passkeyId]/crypto/+server.js";
import "../auth/confirm/+server.js";
import "../auth/register/[id]/+server.js";
import "../auth/resend-confirmation/+server.js";
import "../auth/sessions/+server.js";
import "../auth/sessions/[id]/+server.js";
import "../auth/session/+server.js";
import "../auth/logout/+server.js";
import "../auth/refresh/+server.js";

// Admin routes
import "../admin/exists/+server.js";
import "../admin/init/+server.js";
import "../admin/tenant/+server.js";

// Tenant routes
import "../tenants/+server.js";
import "../tenants/config/defaults/+server.js";
import "../tenants/[id]/+server.js";
import "../tenants/[id]/config/+server.js";

export async function GET() {
  const spec = generateOpenApiSpec();
  return json(spec);
}
