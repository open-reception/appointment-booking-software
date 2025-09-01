import type { UserRole } from "$lib/server/auth/authorization-service";

export type TUser = {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	tenantId: string | null;
};
