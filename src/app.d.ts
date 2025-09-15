// See https://svelte.dev/docs/kit/types#app.d.ts

import type { SelectUser } from "$lib/server/db/central-schema";
import type { Locale } from "$i18n/runtime";

// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user?: SelectUser & { userId: string; sessionId: string; exp: number };
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
