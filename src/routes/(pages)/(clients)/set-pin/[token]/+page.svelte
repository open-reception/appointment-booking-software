<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenteredCard } from "$lib/components/layouts";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton/index";
  import { Headline, Text } from "$lib/components/ui/typography";
  import SetPinForm from "./set-pin-form.svelte";

  const { data } = $props();

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
  {#await data.streaming.tenant}
    <title>OpenReception</title>
  {:then tenant}
    {#if tenant}
      <title>{tenant.longName} - OpenReception</title>
    {/if}
  {/await}
</svelte:head>

<CenteredCard.Root>
  <CenteredCard.Header>
    <CenteredCard.Title>
      {#await data.streaming.tenant}
        <Skeleton class="h-7 w-34" />
      {:then}
        {m["clients.pinReset.page.title"]()}
      {/await}
    </CenteredCard.Title>
    <CenteredCard.Description>
      {#await data.streaming.tenant}
        <Skeleton class="h-4 w-50" />
      {:then}
        {m["clients.pinReset.page.description"]()}
      {/await}
    </CenteredCard.Description>
  </CenteredCard.Header>
  <CenteredCard.Main>
    {#await data.streaming.tenant}
      <Skeleton class="h-3 w-5" />
      <Skeleton class="h-10 w-4/5" />
    {:then tenant}
      {#if tenant && tenant.setupState === "READY"}
        <SetPinForm {formId} {onEvent} />
      {:else}
        <Headline level="h1" style="h4" class="w-full text-center">
          {m["public.tenantNotReady.title"]()}
        </Headline>
        <Text style="sm" class="text-muted-foreground w-full text-center">
          {m["public.tenantNotReady.description"]()}
        </Text>
      {/if}
    {/await}
  </CenteredCard.Main>
  <CenteredCard.Action>
    {#await data.streaming.tenant}
      <Skeleton class="h-10 w-full" />
    {:then}
      <Form.Button
        size="lg"
        class="w-full"
        form={formId}
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        {m["login.action"]()}
      </Form.Button>
    {/await}
  </CenteredCard.Action>
</CenteredCard.Root>
