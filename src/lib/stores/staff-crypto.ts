import { get, writable } from "svelte/store";
import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
import { auth } from "./auth";

interface StaffCryptoState {
  crypto: UnifiedAppointmentCrypto | null;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const createStaffCryptoStore = () => {
  const store = writable<StaffCryptoState>({
    crypto: null,
    isAuthenticating: false,
    isAuthenticated: false,
    error: null,
  });

  return {
    ...store,

    /**
     * Initialize crypto with WebAuthn PRF authentication
     *
     * NOTE: With PRF-based key derivation, we MUST perform a live WebAuthn interaction
     * to derive the secret shard. Session-based reconstruction is not possible.
     *
     * This method now delegates to `authenticate()` which performs WebAuthn with PRF.
     */
    async initFromSession(staffId: string, tenantId: string): Promise<boolean> {
      // With PRF, we always need WebAuthn interaction - session data is not sufficient
      // Call authenticate() directly which will prompt for passkey
      return await this.authenticate(staffId, tenantId);
    },

    /**
     * Authenticate with WebAuthn (for initial login or re-authentication)
     */
    async authenticate(staffId: string, tenantId: string): Promise<boolean> {
      try {
        store.set({
          ...get(store),
          isAuthenticating: true,
          error: null,
        });

        const crypto = new UnifiedAppointmentCrypto();
        await crypto.authenticateStaff(staffId, tenantId);

        store.set({
          crypto,
          isAuthenticating: false,
          isAuthenticated: true,
          error: null,
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Authentication failed";
        store.set({
          crypto: null,
          isAuthenticating: false,
          isAuthenticated: false,
          error: errorMessage,
        });
        console.error("Failed to authenticate staff crypto:", error);
        return false;
      }
    },

    async authenticateAndWait(staffId: string, tenantId: string): Promise<boolean> {
      const isAuthenticating = get(store).isAuthenticating;
      if (isAuthenticating) {
        // Wait for the ongoing authentication to complete
        return new Promise((resolve) => {
          const unsubscribe = store.subscribe((state) => {
            if (!state.isAuthenticating) {
              unsubscribe();
              resolve(state.isAuthenticated);
            }
          });
        });
      } else {
        // Start a new authentication process
        return await this.authenticate(staffId, tenantId);
      }
    },

    /**
     * Clear the staff crypto state and auth data
     */
    clear() {
      auth.clearPasskeyAuthData();
      store.set({
        crypto: null,
        isAuthenticating: false,
        isAuthenticated: false,
        error: null,
      });
    },
  };
};

export const staffCrypto = createStaffCryptoStore();
