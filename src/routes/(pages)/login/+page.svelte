<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import { PageWithClaim } from "$lib/components/ui/page";
  import LoginForm from "./login-form.svelte";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { Button } from "$lib/components/ui/button";
  import { ROUTES } from "$lib/const/routes";

  const { data } = $props();

  const formId = "create-account-form";
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
  <title>{m["login.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  {#snippet left()}
    <Button href={ROUTES.MAIN} size="sm" variant="link">{m["home"]()}</Button>
  {/snippet}
  <CenteredCard.Root>
    <CenteredCard.Header>
      <CenteredCard.Title>
        {m["login.title"]()}
      </CenteredCard.Title>
      <CenteredCard.Description>
        {m["login.description_passphrase"]()}
      </CenteredCard.Description>
    </CenteredCard.Header>
    <CenteredCard.Main>
      <LoginForm {formId} {data} {onEvent} />
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
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
