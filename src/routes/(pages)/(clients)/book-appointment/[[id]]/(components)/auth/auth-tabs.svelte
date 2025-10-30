<script lang="ts">
  import { m } from "$i18n/messages";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Text } from "$lib/components/ui/typography";
  import type { TPublicAppointment } from "$lib/types/public.js";
  import BookAppointmentLoginForm from "./book-appointment-login-form.svelte";
  import BookAppointmentRegisterForm from "./book-appointment-register-form.svelte";

  const { proceed }: { proceed: (a: Partial<TPublicAppointment>) => void } = $props();
</script>

<div class="flex flex-col gap-4 pb-1">
  <Tabs.Root value="register">
    <Tabs.List>
      <Tabs.Trigger value="register">{m["public.steps.auth.register.title"]()}</Tabs.Trigger>
      <Tabs.Trigger value="login">{m["public.steps.auth.login.title"]()}</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="register" class="ml-1 flex flex-col gap-4">
      <Text style="sm" class="font-normal">
        {m["public.steps.auth.register.description"]()}
      </Text>
      <BookAppointmentRegisterForm {proceed} />
    </Tabs.Content>
    <Tabs.Content value="login" class="ml-1 flex flex-col gap-4">
      <Text style="sm" class="font-normal">
        {m["public.steps.auth.login.description"]()}
      </Text>
      <BookAppointmentLoginForm {proceed} />
    </Tabs.Content>
  </Tabs.Root>
</div>
