import { defineConfig } from "drizzle-kit";

// Construct DATABASE_URL from environment variables
const POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_PORT = process.env.POSTGRES_PORT || "5432";
const POSTGRES_DB = process.env.POSTGRES_DB || "appointment_booking";

if (!POSTGRES_PASSWORD) throw new Error("POSTGRES_PASSWORD is not set");

const DATABASE_URL = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`;

export default defineConfig({
  schema: "./src/lib/server/db/central-schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
  out: "./migrations",
  verbose: true,
  strict: true,
});
