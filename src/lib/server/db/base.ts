import { customType } from "drizzle-orm/pg-core";

/**
 * Custom PostgreSQL bytea type for binary data storage
 * Used for storing encrypted data, images, and other binary content
 *
 * @deprecated for now, images are stored as base64-encoded strings in varchar columns
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});
