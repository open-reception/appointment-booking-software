import { json } from "@sveltejs/kit";

export class BackendError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
  }

  public toJson = () => json({ message: this.message }, { status: this.code });
}

export class AuthenticationError extends BackendError {
  constructor(
    message: string,
    public code = 403,
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
