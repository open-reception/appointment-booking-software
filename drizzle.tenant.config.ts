import { defineConfig } from "drizzle-kit";

// This config is used to generate migrations for tenant schemas
// It uses a placeholder database URL that will be replaced at runtime
export default defineConfig({
	schema: "./src/lib/server/db/tenant-schema.ts",
	dialect: "postgresql",
	dbCredentials: { 
		url: "postgresql://placeholder:placeholder@localhost:5432/placeholder"
	},
	out: "./tenant-migrations",
	verbose: true,
	strict: true
});