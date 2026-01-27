<script lang="ts">
  import type { AppointmentData } from "$lib/client/appointment-crypto";
  import { Text } from "$lib/components/ui/typography";
  import { staffCrypto } from "$lib/stores/staff-crypto";
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
  let error = $state<string | undefined>();

  onMount(() => {
    decrypt();
  });

  const decrypt = async () => {
    if (!item.appointment) {
      console.error("Unable to decrypt appointment data - no appointment data in item.", item.id);
      error = "Missing data";
      return;
    }

    // Check if we have all required encrypted data
    if (!item.appointment.encryptedPayload || !item.appointment.iv || !item.appointment.authTag) {
      console.error("Unable to decrypt appointment data - missing encrypted fields.", item.id);
      error = "Missing encrypted data";
      return;
    }

    // Check if we have staffKeyShare
    if (!item.appointment.staffKeyShare) {
      console.error("Unable to decrypt appointment data - missing staffKeyShare.", item.id);
      error = "Missing key share";
      return;
    }

    // Wait for crypto to be initialized (max 5 seconds)
    if (!$staffCrypto.isAuthenticated || !$staffCrypto.crypto) {
      const maxWaitTime = 5000; // 5 seconds
      const startTime = Date.now();

      while (!$staffCrypto.isAuthenticated && Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!$staffCrypto.isAuthenticated || !$staffCrypto.crypto) {
        error = "Crypto not initialized";
        console.error("Staff crypto not initialized after waiting");
        return;
      }
    }

    try {
      // Client-side decryption using the appointment data from calendar response
      decrypted = await $staffCrypto.crypto.decryptStaffAppointment({
        encryptedAppointment: {
          encryptedPayload: item.appointment.encryptedPayload,
          iv: item.appointment.iv,
          authTag: item.appointment.authTag,
        },
        staffKeyShare: item.appointment.staffKeyShare,
      });
    } catch (err) {
      console.error("Error decrypting appointment:", err);
      error = err instanceof Error ? err.message : "Decryption failed";
    }
  };

  const setCalendarItem = () => {
    if (decrypted) {
      calendarStore.setCurItem({ appointment: item, decrypted });
    }
  };
</script>

{#if error}
  <div class="text-destructive flex h-full items-center gap-1 px-1">
    <Text style="xs" class="leading-none text-(--channel-color-contrast)" title={error}>
      ⚠️ {m["calendar.decryptingError"]()}
    </Text>
  </div>
{:else if decrypted === undefined}
  <div class="flex h-full items-center gap-1 px-1">
    <Loader2Icon class="h-3/4 max-h-4 w-auto animate-spin" />
    <Text style="xs" class="leading-none text-(--channel-color-contrast)"
      >{m["calendar.decrypting"]()}</Text
    >
  </div>
{:else if decrypted}
  <Button
    class="m-0 h-full w-full cursor-pointer justify-start rounded-none px-1 leading-none text-(--channel-color-contrast) hover:bg-transparent! hover:text-(--channel-color-contrast) focus:ring-1"
    variant="ghost"
    onclick={setCalendarItem}
  >
    {decrypted.name}
  </Button>
{/if}
