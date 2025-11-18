import { writable } from "svelte/store";
import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
import { auth } from "./auth";

interface StaffCryptoState {
  crypto: UnifiedAppointmentCrypto | null;
  isAuthenticated: boolean;
  error: string | null;
}

const createStaffCryptoStore = () => {
  const store = writable<StaffCryptoState>({
    crypto: null,
    isAuthenticated: false,
    error: null,
  });

  return {
    ...store,

    /**
     * Initialize crypto from stored authenticator data after login
     * This reconstructs the private key using the passkey data from auth store
     */
    async initFromSession(staffId: string, tenantId: string): Promise<boolean> {
      try {
        // Check if we have passkey auth data from login
        const passkeyAuthData = auth.getPasskeyAuthData();
        if (!passkeyAuthData) {
          console.warn("No passkey auth data found in auth store");
          return false;
        }

        const { authenticatorData, passkeyId } = passkeyAuthData;

        // Reconstruct the private key using the stored data
        const crypto = new UnifiedAppointmentCrypto();

        // Use the stored authenticator data to reconstruct keys
        await crypto.reconstructStaffKeysFromSession(
          staffId,
          tenantId,
          passkeyId,
          authenticatorData,
        );

        store.set({
          crypto,
          isAuthenticated: true,
          error: null,
        });

        console.log("✅ Staff crypto initialized from session");
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to init from session";
        store.set({
          crypto: null,
          isAuthenticated: false,
          error: errorMessage,
        });
        console.error("Failed to initialize staff crypto from session:", error);
        return false;
      }
    },

    /**
     * Authenticate with WebAuthn (for initial login or re-authentication)
     */
    async authenticate(staffId: string, tenantId: string): Promise<boolean> {
      try {
        const crypto = new UnifiedAppointmentCrypto();
        await crypto.authenticateStaff(staffId, tenantId);

        store.set({
          crypto,
          isAuthenticated: true,
          error: null,
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Authentication failed";
        store.set({
          crypto: null,
          isAuthenticated: false,
          error: errorMessage,
        });
        console.error("Failed to authenticate staff crypto:", error);
        return false;
      }
    },

    /**
     * Clear the staff crypto state and auth data
     */
    clear() {
      auth.clearPasskeyAuthData();
      store.set({
        crypto: null,
        isAuthenticated: false,
        error: null,
      });
    },
  };
};

export const staffCrypto = createStaffCryptoStore();
