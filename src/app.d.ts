// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Locale } from "$i18n/runtime";
import type { UserRole } from "$lib/server/auth/authorization-service";
import type { JWTPayload } from "jose";

// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user?: JWTPayload & {
        userId: string;
        sessionId: string;
        name: string;
        email: string;
        role: UserRole;
        tenantId?: string | null;
      };
      locale?: Locale;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
  interface PageState {
    email?: string;
  }
}

export {};
