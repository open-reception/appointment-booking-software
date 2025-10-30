<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { publicStore } from "$lib/stores/public.js";
  import { Check } from "@lucide/svelte/icons";

  import { onMount } from "svelte";

  const { data } = $props();
  const tenant = $derived($publicStore.tenant);
  let isRequest = $state(true);

  onMount(() => {
    if (history.state["sveltekit:states"]?.isRequest === true) {
      isRequest = true;
      history.replaceState({}, "");
    }
  });
</script>

<svelte:head>
  {#await data.streaming.tenant}
    <title>{m["public.bookAppointment"]()} - OpenReception</title>
  {:then tenant}
    {#if tenant}
      <title>{m["public.bookAppointment"]()} - {tenant.longName} - OpenReception</title>
    {/if}
  {/await}
</svelte:head>

{#if tenant}
  <CenterState
    Icon={Check}
    headline={isRequest
      ? m["public.steps.complete.request.title"]()
      : m["public.steps.complete.book.title"]()}
    description={isRequest
      ? m["public.steps.complete.request.description"]({ name: tenant.longName })
      : m["public.steps.complete.book.description"]()}
  />
{/if}
