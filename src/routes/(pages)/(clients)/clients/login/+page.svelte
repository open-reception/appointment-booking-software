<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import { Button } from "$lib/components/ui/button";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { ROUTES } from "$lib/const/routes";
  import ClientLoginForm from "./client-login-form.svelte";

  const formId = "client-login-form";
  let isSubmitting = $state(false);

  const onEvent: EventReporter = (params) => {
    if (params.isSubmitting) {
      isSubmitting = true;
    }
    if (params.isSubmitting === false) {
      isSubmitting = false;
    }
  };
</script>

<svelte:head>
  <title>{m["clients.login.title"]()} - OpenReception</title>
</svelte:head>

<CenteredCard.Root>
  <CenteredCard.Header>
    <CenteredCard.Title>
      {m["clients.login.title"]()}
    </CenteredCard.Title>
    <CenteredCard.Description>
      {m["clients.login.description"]()}
    </CenteredCard.Description>
  </CenteredCard.Header>
  <CenteredCard.Main>
    <ClientLoginForm {formId} {onEvent} />
  </CenteredCard.Main>
  <CenteredCard.Action>
    <Form.Button
      size="lg"
      class="w-full"
      form={formId}
      isLoading={isSubmitting}
      disabled={isSubmitting}
    >
      {m["login.action"]()}
    </Form.Button>
    <Button href={resolve(ROUTES.LOGIN)} variant="link">{m["clients.login.altAction"]()}</Button>
  </CenteredCard.Action>
</CenteredCard.Root>
