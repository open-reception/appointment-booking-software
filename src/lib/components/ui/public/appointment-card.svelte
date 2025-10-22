<script lang="ts">
  import { m } from "$i18n/messages";
  import * as Card from "$lib/components/ui/card";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public";
  import type { TPublicAppointment } from "$lib/types/public";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    class: className,
    appointment,
  }: HTMLAttributes<HTMLDivElement> & { appointment?: TPublicAppointment } = $props();
  const tenant = $derived($publicStore.tenant);
</script>

{#if tenant && appointment}
  <div class={className}>
    <Card.Title class="flex gap-3">
      {#if typeof tenant.logo === "string" && tenant.logo}
        <img
          src={tenant.logo}
          alt={tenant.longName}
          class="border-muted block size-15 rounded-lg border object-cover object-center"
          loading="lazy"
        />
      {/if}
      <div class="flex flex-col gap-1">
        <Headline level="h1" style="h6">
          {tenant?.longName}
        </Headline>
        <Text style="xs" color="medium" class="font-normal whitespace-pre-line">
          {m["public.bookAppointment"]()}
        </Text>
      </div>
    </Card.Title>
  </div>
{/if}
