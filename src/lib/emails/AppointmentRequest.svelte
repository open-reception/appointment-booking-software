<script lang="ts">
  import { m } from "$i18n/messages";
  import { setLocale } from "$i18n/runtime";
  import type { SupportedLocale } from "$lib/const/locales";
  import type { SelectTenant } from "$lib/server/db/central-schema";
  import { type SelectAppointment } from "$lib/server/db/tenant-schema";
  import type { SelectClient } from "$lib/server/email/email-service";
  import EmailHeadline from "./components/EmailHeadline.svelte";
  import EmailLayout from "./components/EmailLayout.svelte";
  import EmailText from "./components/EmailText.svelte";
  import { renderAppointmentDate, renderAppointmentTime } from "./utils";

  let {
    locale,
    user,
    tenant,
    channel,
    appointment,
    address,
  }: {
    locale: SupportedLocale;
    user: SelectClient;
    tenant: SelectTenant;
    channel: string;
    appointment: SelectAppointment & { agentName: string };
    address: {
      street: string;
      number: string;
      additionalAddressInfo?: string;
      zip: string;
      city: string;
    };
  } = $props();

  setLocale(locale);
</script>

<EmailLayout>
  <EmailText variant="md">{m["emails.greeting"]({ name: user.email })}</EmailText>
  <EmailText variant="md">
    {m["emails.appointmentRequest.introduction"]()}
  </EmailText>
  <EmailHeadline>{channel}</EmailHeadline>
  <EmailText variant="md">
    {appointment.agentName}<br />
    {renderAppointmentDate(appointment.appointmentDate, locale)}<br />
    {renderAppointmentTime(appointment.appointmentDate, locale)}
    {m["emails.oclock"]()}
  </EmailText>
  <EmailHeadline>{tenant.longName}</EmailHeadline>
  <EmailText variant="md">
    {address.street}
    {address.number}<br />
    {#if address.additionalAddressInfo}{address.additionalAddressInfo}<br />{/if}
    {address.zip}
    {address.city}
  </EmailText>
  <EmailText variant="md" color="text-light">
    {m["emails.appointmentRequest.reason"]()}
  </EmailText>
</EmailLayout>
