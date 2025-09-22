import type { JWTPayload } from "jose";
import { UniversalLogger } from "$lib/logger";
import { AuthorizationError, AuthenticationError } from "$lib/server/utils/errors";

const logger = new UniversalLogger().setContext("Authorization");

export type UserRole = "GLOBAL_ADMIN" | "TENANT_ADMIN" | "STAFF";

export class AuthorizationService {
  static requireRole(user: JWTPayload, requiredRole: UserRole): void {
    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role !== requiredRole) {
      logger.warn(
        `Access denied: User ${user.email} has role ${user.role}, required ${requiredRole}`,
      );
      throw new AuthorizationError();
    }

    logger.debug(`Authorization granted: User ${user.email} has required role ${requiredRole}`);
  }

  static requireAnyRole(user: JWTPayload, allowedRoles: UserRole[]): void {
    if (!user) {
      throw new AuthenticationError();
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      logger.warn(
        `Access denied: User ${user.email} has role ${user.role}, allowed roles: ${allowedRoles.join(", ")}`,
      );
      throw new AuthorizationError();
    }

    logger.debug(`Authorization granted: User ${user.email} has allowed role ${user.role}`);
  }

  static requireTenantAccess(user: JWTPayload, tenantId: string): void {
    if (!user) {
      throw new AuthenticationError();
    }

    if (user.role === "GLOBAL_ADMIN") {
      logger.debug(
        `Authorization granted: Global admin ${user.email} accessing tenant ${tenantId}`,
      );
      return;
    }

    if (user.role === "TENANT_ADMIN" || user.role === "STAFF") {
      if (!user.tenantId) {
        logger.warn(`Access denied: User ${user.email} has no tenant assigned`);
        throw new AuthorizationError("No tenant access");
      }

      if (user.tenantId !== tenantId) {
        logger.warn(
          `Access denied: User ${user.email} trying to access tenant ${tenantId}, but belongs to ${user.tenantId}`,
        );
        throw new AuthorizationError("Tenant access denied");
      }

      logger.debug(`Authorization granted: User ${user.email} accessing own tenant ${tenantId}`);
      return;
    }

    logger.warn(`Access denied: User ${user.email} has invalid role ${user.role}`);
    throw new AuthorizationError("Invalid role");
  }

  static requireGlobalAdmin(user: JWTPayload): void {
    this.requireRole(user, "GLOBAL_ADMIN");
  }

  static requireTenantAdmin(user: JWTPayload, tenantId?: string): void {
    this.requireAnyRole(user, ["GLOBAL_ADMIN", "TENANT_ADMIN"]);

    if (tenantId && user.role === "TENANT_ADMIN") {
      this.requireTenantAccess(user, tenantId);
    }
  }

  static requireStaffOrAbove(user: JWTPayload, tenantId?: string): void {
    this.requireAnyRole(user, ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"]);

    if (tenantId && (user.role === "TENANT_ADMIN" || user.role === "STAFF")) {
      this.requireTenantAccess(user, tenantId);
    }
  }

  static canAccessTenant(user: JWTPayload, tenantId: string): boolean {
    try {
      this.requireTenantAccess(user, tenantId);
      return true;
    } catch {
      return false;
    }
  }

  static isGlobalAdmin(user: JWTPayload): boolean {
    return user.role === "GLOBAL_ADMIN";
  }

  static isTenantAdmin(user: JWTPayload): boolean {
    return user.role === "TENANT_ADMIN";
  }

  static isStaff(user: JWTPayload): boolean {
    return user.role === "STAFF";
  }

  static hasRole(user: JWTPayload, role: UserRole): boolean {
    return user.role === role;
  }

  static hasAnyRole(user: JWTPayload, roles: UserRole[]): boolean {
    return roles.includes(user.role as UserRole);
  }

  static getUserTenantId(user: JWTPayload): string | null {
    return (user.tenantId as string) || null;
  }
}

export function withAuthorization(
  user: JWTPayload,
  requiredRole?: UserRole,
  allowedRoles?: UserRole[],
) {
  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  if (requiredRole) {
    AuthorizationService.requireRole(user, requiredRole);
  }

  if (allowedRoles) {
    AuthorizationService.requireAnyRole(user, allowedRoles);
  }
}
