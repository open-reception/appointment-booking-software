import { ERRORS } from "$lib/errors";
import type { UniversalLogger } from "$lib/logger";
import { json } from "@sveltejs/kit";

export const logError =
  (logger: UniversalLogger) =>
  (message: string, error: unknown, requestedBy?: string, tenantId?: string) => {
    logger.error(message, {
      tenantId,
      requestedBy,
      error: JSON.stringify(error || "?"),
    });
  };

export class BackendError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
  }

  public toJson = () => json({ error: this.message, message: this.message }, { status: this.code });
}

export class AuthorizationError extends BackendError {
  constructor(
    message: string = ERRORS.SECURITY.AUTHORIZATION_FAILED,
    public code = 403,
  ) {
    super(message, code);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends BackendError {
  constructor(
    message: string = ERRORS.SECURITY.AUTHENTICATION_REQUIRED,
    public code = 401,
  ) {
    super(message, code);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends BackendError {
  constructor(
    message: string,
    public code = 422,
  ) {
    super(message, code);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends BackendError {
  constructor(
    message: string,
    public code = 404,
  ) {
    super(message, code);
    this.name = "ValidationError";
  }
}

export class ConflictError extends BackendError {
  constructor(
    message: string,
    public code = 409,
  ) {
    super(message, code);
    this.name = "ConflictError";
  }
}

export class InternalError extends BackendError {
  constructor(
    message: string = ERRORS.BACKEND.OBFUSCATED,
    public code = 500,
  ) {
    super(message, code);
    this.name = "InternalError";
  }
}
