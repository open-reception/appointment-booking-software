<script lang="ts">
  import { m } from "$i18n/messages";
  import { setLocale } from "$i18n/runtime";
  import type { SupportedLocale } from "$lib/const/locales";
  import { type SelectTenant } from "$lib/server/db/central-schema";
  import type { SelectClient } from "$lib/server/email/email-service";
  import EmailButton from "./components/EmailButton.svelte";
  import EmailLayout from "./components/EmailLayout.svelte";
  import EmailText from "./components/EmailText.svelte";

  let {
    locale,
    user,
    tenant,
    loginUrl,
  }: {
    locale: SupportedLocale;
    user: SelectClient;
    tenant: SelectTenant;
    loginUrl: string;
  } = $props();

  $effect(() => {
    setLocale(locale);
  });
</script>

<EmailLayout>
  <EmailText variant="md">{m["emails.greeting"]({ name: user.email })}</EmailText>
  <EmailText variant="md">
    {m["emails.pinReset.introduction"]({ tenant: tenant.longName })}
  </EmailText>
  <EmailButton href={loginUrl}>{m["emails.pinReset.action"]()}</EmailButton>
  <EmailText variant="md" color="text-light">
    {m["emails.pinReset.reason"]()}
  </EmailText>
</EmailLayout>
