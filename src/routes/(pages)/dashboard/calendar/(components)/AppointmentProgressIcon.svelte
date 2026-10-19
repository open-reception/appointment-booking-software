<script lang="ts">
  import { type SelectAppointmentProgress } from "$lib/server/db/tenant-schema";
  import { Armchair, Check, CircleQuestionMark, Footprints, RefreshCw } from "@lucide/svelte";

  let {
    icon,
    class: className,
  }: {
    icon: SelectAppointmentProgress["icon"];
    class?: string;
  } = $props();
</script>

{#if ["FOOTPRINTS"].includes(icon)}
  <Footprints class={className} />
{:else if ["REFRESH_CW"].includes(icon)}
  <RefreshCw class={className} />
{:else if ["ARMCHAIR"].includes(icon)}
  <Armchair class={className} />
{:else if ["CHECK"].includes(icon)}
  <Check class={className} />
{:else}
  <CircleQuestionMark class={className} />
{/if}
