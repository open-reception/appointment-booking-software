<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import type { SelectAgent } from "$lib/server/db/tenant-schema";
  import type { TAddAppointment } from "./types";
  import UnknownItemIcon from "@lucide/svelte/icons/user-star";

  let {
    newAppointment,
    availableAgents,
    proceed,
  }: {
    newAppointment: TAddAppointment;
    availableAgents: SelectAgent[];
    proceed: (data: TAddAppointment) => void;
  } = $props();
</script>

<div class="flex flex-col gap-2">
  <Text style="sm" class="block font-medium">
    {m["calendar.addAppointment.steps.agents.title"]()}
  </Text>
  <ul class="flex w-full flex-col gap-2">
    {#each availableAgents as agent (agent.id)}
      <li>
        <Button
          variant="outline"
          class="flex h-auto w-full cursor-pointer items-center gap-4 px-2 py-1.5 text-left"
          onclick={() => proceed({ ...newAppointment, agentId: agent.id })}
        >
          {#if agent.image}
            <img
              src={agent.image}
              alt={agent.name}
              class="size-8 rounded-full border object-cover object-center"
              loading="lazy"
            />
          {:else}
            <UnknownItemIcon
              class="bg-muted text-muted-foreground size-15 rounded-full border stroke-1 p-1"
            />
          {/if}
          <div class="flex grow flex-col gap-1">
            <Text style="md" class="font-medium">
              {agent.name}
            </Text>
          </div>
        </Button>
      </li>
    {/each}
  </ul>
</div>
