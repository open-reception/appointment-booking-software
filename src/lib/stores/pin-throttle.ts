import { writable } from "svelte/store";

/**
 * PIN Throttle Store
 *
 * Persists throttle state across page reloads and component remounts.
 * Tracks when the user can next attempt PIN authentication.
 */

interface PinThrottleState {
  emailHash: string | null;
  throttleUntil: number | null; // Timestamp when throttle expires (milliseconds)
  failedAttempts: number;
}

const STORAGE_KEY = "pin-throttle-state";

const createPinThrottleStore = () => {
  // Initialize from localStorage if available
  const initialState: PinThrottleState = {
    emailHash: null,
    throttleUntil: null,
    failedAttempts: 0,
  };

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Only restore if throttle hasn't expired yet
        if (parsed.throttleUntil && parsed.throttleUntil > Date.now()) {
          Object.assign(initialState, parsed);
        } else {
          // Throttle expired, clear storage
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        console.error("Failed to parse throttle state:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  const store = writable<PinThrottleState>(initialState);

  return {
    subscribe: store.subscribe,

    /**
     * Set throttle state when a 429 response is received
     * @param emailHash The email hash that is throttled
     * @param retryAfterMs How many milliseconds to wait before retry
     * @param failedAttempts Current number of failed attempts
     */
    setThrottle: (emailHash: string, retryAfterMs: number, failedAttempts: number = 0) => {
      const throttleUntil = Date.now() + retryAfterMs;
      const newState: PinThrottleState = {
        emailHash,
        throttleUntil,
        failedAttempts,
      };

      store.set(newState);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      }
    },

    /**
     * Clear throttle state after successful authentication
     */
    clearThrottle: () => {
      store.set({
        emailHash: null,
        throttleUntil: null,
        failedAttempts: 0,
      });
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    /**
     * Check if a specific email hash is currently throttled
     * @param emailHash The email hash to check
     * @returns true if throttled, false otherwise
     */
    isThrottled: (emailHash: string): boolean => {
      let isThrottled = false;
      store.subscribe((state) => {
        if (
          state.emailHash === emailHash &&
          state.throttleUntil &&
          state.throttleUntil > Date.now()
        ) {
          isThrottled = true;
        }
      })();
      return isThrottled;
    },

    /**
     * Get remaining throttle time in milliseconds
     * @param emailHash The email hash to check
     * @returns Milliseconds remaining, or 0 if not throttled
     */
    getRemainingTime: (emailHash: string): number => {
      let remaining = 0;
      store.subscribe((state) => {
        if (
          state.emailHash === emailHash &&
          state.throttleUntil &&
          state.throttleUntil > Date.now()
        ) {
          remaining = state.throttleUntil - Date.now();
        }
      })();
      return Math.max(0, remaining);
    },
  };
};

export const pinThrottleStore = createPinThrottleStore();
