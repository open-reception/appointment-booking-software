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
    confirmUrl,
    expirationMinutes,
  }: {
    locale: SupportedLocale;
    user: SelectUserEmail;
    confirmUrl: string;
    expirationMinutes: number;
  } = $props();

  $effect(() => {
    setLocale(locale);
  });
</script>

<EmailLayout>
  <EmailText variant="md">{m["emails.greeting"]({ name: user.name })}</EmailText>
  <EmailText variant="md">
    {m["emails.confirmation.introduction"]()}
  </EmailText>
  <EmailButton href={confirmUrl}>{m["emails.confirmation.action"]()}</EmailButton>
  <EmailText variant="md">
    {m["emails.confirmation.hint"]({ expirationMinutes })}
  </EmailText>
  <EmailText variant="md" color="text-light">
    {m["emails.confirmation.reason"]()}
  </EmailText>
</EmailLayout>
