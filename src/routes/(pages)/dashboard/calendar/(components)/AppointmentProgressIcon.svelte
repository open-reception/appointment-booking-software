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

{#if ["NOT_STARTED", "FOOTSTEPS"].includes(icon)}
  <Footprints class={className} />
{:else if ["IN_PROGRESS", "REFRESH"].includes(icon)}
  <RefreshCw class={className} />
{:else if ["WAITING", "ARMCHAIR"].includes(icon)}
  <Armchair class={className} />
{:else if ["DONE", "CHECK"].includes(icon)}
  <Check class={className} />
{:else}
  <CircleQuestionMark class={className} />
{/if}
