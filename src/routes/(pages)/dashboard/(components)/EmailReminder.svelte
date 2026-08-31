<script lang="ts">
  import { getLocale } from "$i18n/runtime";
  import { getStaffKeyShares } from "$lib/client/crypto";
  import * as Card from "$lib/components/ui/card";
  import { EMAIL_TYPE } from "$lib/const/email";
  import { staffCrypto } from "$lib/stores/staff-crypto";
  import { tenants } from "$lib/stores/tenants";
  import type { TEmailAppointmentReminder } from "$lib/types/emails";
  import { Check, Cross, Loader2 } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { getNextAppointments, sendAppointmentReminders } from "./utils";
  import { m } from "$i18n/messages";

  let status: "init" | "loading" | "sending" | "success" | "error" = $state("init");
  let appointments: TEmailAppointmentReminder[] = $state([]);

  onMount(() => {
    sendReminders();
  });

  const sendReminders = async () => {
    const tenantId = $tenants.currentTenant?.id;
    if (tenantId) {
      status = "loading";

      // Wait a moment for staff to recognize
      // Also gives staff crypto time to load, if not already loaded
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const allAppointments = await getNextAppointments(tenantId);
      const decryptPromises = allAppointments.map(async (appointment) => {
        if (
          !$staffCrypto.crypto ||
          !appointment.encryptedPayload ||
          !appointment.iv ||
          !appointment.authTag
        )
          return undefined;

        // Skip if reminder was already sent
        if (appointment.remindedAt) return undefined;

        // Skip if appointment is booked today
        if (
          appointment.createdAt &&
          new Date(appointment.createdAt).toDateString() === new Date().toDateString()
        )
          return undefined;

        const staffKeyShares = await getStaffKeyShares(tenantId, appointment.tunnelId);
        const staffKeyShare = staffKeyShares[0];

        const decryptedAppointment = await $staffCrypto.crypto.decryptStaffAppointment({
          encryptedAppointment: {
            encryptedPayload: appointment.encryptedPayload,
            iv: appointment.iv,
            authTag: appointment.authTag,
          },
          staffKeyShare: staffKeyShare.encryptedTunnelKey,
        });

        // Remove clients that don't want notifications
        if (decryptedAppointment.shareEmail !== true) return undefined;

        return {
          type: EMAIL_TYPE.APPOINTMENT_REMINDER,
          appointment: {
            id: appointment.id,
            appointmentDate: new Date(appointment.appointmentDate),
            timezone: appointment.timezone,
            name: decryptedAppointment.name,
            email: decryptedAppointment.email,
            locale: decryptedAppointment.locale || getLocale(),
          },
        };
      });
      const decryptedAppointments = await Promise.all(decryptPromises);
      appointments = decryptedAppointments.filter((it) => it !== undefined);

      if (appointments.length > 0) {
        status = "sending";
        const resp = await sendAppointmentReminders(tenantId, appointments);
        status = resp ? "success" : "error";
      } else {
        status = "success";
      }
    } else {
      status = "error";
    }
  };
</script>

<Card.Root class="gap-2 p-3">
  <Card.Header class="p-0">
    <Card.Title>{m["dashboard.appointmentReminders.title"]()}</Card.Title>
    <Card.Description class="flex items-center gap-2">
      {#if ["init", "loading"].includes(status)}
        <Loader2 class="size-4 animate-spin" />
        {m["dashboard.appointmentReminders.loading"]()}
      {:else if appointments.length === 0}
        <Check class="size-4" />
        {m["dashboard.appointmentReminders.noRemindersToSend"]()}
      {:else if status === "sending"}
        <Loader2 class="size-4 animate-spin" />
        {m["dashboard.appointmentReminders.sending"]({ length: appointments.length })}
      {:else if status === "success"}
        <Check class="size-4" />
        {m["dashboard.appointmentReminders.success"]({ length: appointments.length })}
      {:else}
        <Cross class="size-4" />
        {m["dashboard.appointmentReminders.error"]()}
      {/if}
    </Card.Description>
  </Card.Header>
</Card.Root>
