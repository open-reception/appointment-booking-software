<script lang="ts">
  import { m } from "$i18n/messages";
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
</script>

<EmailLayout {locale}>
  <EmailText variant="md">{m["emails.greeting"]({ name: user.name }, { locale })}</EmailText>
  <EmailText variant="md">
    {m["emails.notification.introduction"]({}, { locale })}
  </EmailText>
  <EmailButton href={dashboardUrl}>{m["emails.notification.action"]({}, { locale })}</EmailButton>
  <EmailText variant="md" color="text-light">
    {m["emails.notification.reason"]({}, { locale })}
  </EmailText>
</EmailLayout>
