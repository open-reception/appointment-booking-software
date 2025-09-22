<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import { PageWithClaim } from "$lib/components/ui/page";
  import CreateAdminAccountForm from "./create-account-form.svelte";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";

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
  <title>{m["setup.create_admin_account.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Header>
      <CenteredCard.Title>
        {m["setup.create_admin_account.title"]()}
      </CenteredCard.Title>
      <CenteredCard.Description>
        {m["setup.create_admin_account.description"]()}
      </CenteredCard.Description>
    </CenteredCard.Header>
    <CenteredCard.Main>
      <CreateAdminAccountForm {formId} {data} {onEvent} />
    </CenteredCard.Main>
    <CenteredCard.Action>
      <Form.Button
        size="lg"
        class="w-full"
        form={formId}
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        {m["setup.create_admin_account.action"]()}
      </Form.Button>
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
