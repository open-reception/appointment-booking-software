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
    confirmUrl,
    expirationMinutes,
  }: {
    locale: SupportedLocale;
    user: SelectUserEmail;
    confirmUrl: string;
    expirationMinutes: number;
  } = $props();
</script>

<EmailLayout {locale}>
  <EmailText variant="md">
    {m["emails.greeting"]({ name: user.name }, { locale })}
  </EmailText>
  <EmailText variant="md">
    {m["emails.confirmation.introduction"]({}, { locale })}
  </EmailText>
  <EmailButton {locale} href={confirmUrl}>
    {m["emails.confirmation.action"]({}, { locale })}
  </EmailButton>
  <EmailText variant="md">
    {m["emails.confirmation.hint"]({ expirationMinutes }, { locale })}
  </EmailText>
  <EmailText variant="md" color="text-light">
    {m["emails.confirmation.reason"]({}, { locale })}
  </EmailText>
</EmailLayout>
