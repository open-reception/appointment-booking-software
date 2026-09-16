<script lang="ts">
  import type { TChannelWithFullAgents } from "$lib/types/channel";
  import { cn } from "$lib/utils";

  let { entity }: { entity: TChannelWithFullAgents } = $props();
</script>

<div
  class={cn("h-full min-h-12 w-2 rounded-md")}
  style={`background-color: ${entity.color};`}
></div>
