<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { PageWithClaim } from "$lib/components/ui/page";
  import SetupPasskeyForm from "./setup-passkey-form.svelte";

  const { data } = $props();

  const formId = "setup-passkey";
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
  <title>{m["setupPasskey.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Header>
      <CenteredCard.Title>
        {m["setupPasskey.title"]()}
      </CenteredCard.Title>
      <CenteredCard.Description>
        {m["setupPasskey.description"]()}
      </CenteredCard.Description>
    </CenteredCard.Header>
    <CenteredCard.Main>
      <SetupPasskeyForm {formId} {data} {onEvent} />
    </CenteredCard.Main>
    <CenteredCard.Action>
      <Form.Button
        size="lg"
        class="w-full"
        form={formId}
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        {m["setupPasskey.action"]()}
      </Form.Button>
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
