<script lang="ts">
  import { m } from "$i18n/messages";
  import { setLocale } from "$i18n/runtime";
  import type { SupportedLocale } from "$lib/const/locales";
  import type { SelectUserEmail } from "$lib/server/email/email-service";
  import EmailButton from "./components/EmailButton.svelte";
  import EmailLayout from "./components/EmailLayout.svelte";
  import EmailText from "./components/EmailText.svelte";

  let {
    locale,
    user,
    dashboardUrl,
  }: {
    locale: SupportedLocale;
    user: SelectUserEmail;
    dashboardUrl: string;
  } = $props();

  $effect(() => {
    setLocale(locale);
  });
</script>

<EmailLayout>
  <EmailText variant="md">{m["emails.greeting"]({ name: user.name })}</EmailText>
  <EmailText variant="md">
    {m["emails.notification.introduction"]()}
  </EmailText>
  <EmailButton href={dashboardUrl}>{m["emails.notification.action"]()}</EmailButton>
  <EmailText variant="md" color="text-light">
    {m["emails.notification.reason"]()}
  </EmailText>
</EmailLayout>
