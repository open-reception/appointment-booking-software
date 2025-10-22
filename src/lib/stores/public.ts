import type { TPublicTenant, TPublicAppointment } from "$lib/types/public";
import { writable } from "svelte/store";

interface PublicState {
  isLoading: boolean;
  tenant?: TPublicTenant;
  locale: string;
  newAppointment?: TPublicAppointment;
}

const createPublicStore = () => {
  const store = writable<PublicState>({
    isLoading: false,
    locale: "en",
    newAppointment: {},
  });

  return {
    ...store,
  };
};

export const publicStore = createPublicStore();
