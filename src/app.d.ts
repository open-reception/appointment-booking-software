// See https://svelte.dev/docs/kit/types#app.d.ts

import type { JWTPayload } from "jose";

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: JWTPayload & { userId: string; sessionId: string };
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
