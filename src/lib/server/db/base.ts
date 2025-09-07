import { customType } from "drizzle-orm/pg-core";

/**
 * Custom PostgreSQL bytea type for binary data storage
 * Used for storing encrypted data, images, and other binary content
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});
