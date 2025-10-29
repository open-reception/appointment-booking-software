import type { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
import type { TPublicTenant, TPublicAppointment, TPublicChannel } from "$lib/types/public";
import { writable } from "svelte/store";

interface PublicState {
  isLoading: boolean; // probably not needed
  locale: string;
  newAppointment: TPublicAppointment;
  tenant?: TPublicTenant;
  channels?: TPublicChannel[];
  crypto?: UnifiedAppointmentCrypto;
}

const createPublicStore = () => {
  const store = writable<PublicState>({
    isLoading: false,
    locale: "en",
    newAppointment: { step: "SELECT_CHANNEL" },
  });

  return {
    ...store,
    reset: () =>
      store.update((state) => ({
        ...state,
        newAppointment: { step: "SELECT_CHANNEL" },
        crypto: undefined,
      })),
  };
};

export const publicStore = createPublicStore();
