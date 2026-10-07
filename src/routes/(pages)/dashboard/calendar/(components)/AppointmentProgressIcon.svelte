<script lang="ts">
  import { type SelectAppointmentProgress } from "$lib/server/db/tenant-schema";
  import { Armchair, Check, CircleQuestionMark, Footprints, Hourglass } from "@lucide/svelte";

  let {
    icon,
    class: className,
  }: {
    icon: SelectAppointmentProgress["icon"];
    class?: string;
  } = $props();
</script>

{#if icon === "NOT_STARTED"}
  <Footprints class={className} />
{:else if icon === "IN_PROGRESS"}
  <Hourglass class={className} />
{:else if icon === "WAITING"}
  <Armchair class={className} />
{:else if icon === "DONE"}
  <Check class={className} />
{:else}
  <CircleQuestionMark class={className} />
{/if}
