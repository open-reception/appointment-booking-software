<script lang="ts">
  import { UnifiedAppointmentCrypto, type AppointmentData } from "$lib/client/appointment-crypto";
  import { Text } from "$lib/components/ui/typography";
  import { auth } from "$lib/stores/auth";
  import { type TCalendarItem } from "$lib/types/calendar";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import { onMount } from "svelte";
  import { calendarStore } from "$lib/stores/calendar";
  import { Button } from "$lib/components/ui/button";
  import { m } from "$i18n/messages";

  let {
    item,
  }: {
    item: TCalendarItem;
  } = $props();

  let decrypted = $state<AppointmentData | undefined>();

  onMount(() => {
    decrypt();
  });

  const decrypt = async () => {
    if (item.appointment?.encryptedData && $auth.user?.tenantId) {
      const crypto = new UnifiedAppointmentCrypto();
      await crypto.authenticateStaff($auth.user?.id, $auth.user?.tenantId);
      const appointments = await crypto.getStaffAppointments($auth.user?.tenantId);
      decrypted = await crypto.decryptStaffAppointment({
        encryptedAppointment: {
          encryptedPayload: "",
          iv: "",
          authTag: "",
        },
        staffKeyShare: "",
      });
    } else {
      console.error("Unable to decrypt appointment data with missing information.", item.id);
    }
  };

  const setCalendarItem = () => {
    if (decrypted) {
      calendarStore.setCurItem({ appointment: item, decrypted });
    }
  };
</script>

{#if decrypted === undefined}
  <div class="flex h-full items-center gap-1 px-1">
    <Loader2Icon class="h-3/4 max-h-4 w-auto animate-spin" />
    <Text style="xs" class="leading-none">{m["calendar.decrypting"]()}</Text>
  </div>
{:else if decrypted}
  <Button
    class="m-0 h-full w-full cursor-pointer justify-start rounded-none px-1 leading-none hover:bg-transparent focus:ring-1"
    variant="ghost"
    onclick={setCalendarItem}
  >
    {decrypted.name}
  </Button>
{/if}
