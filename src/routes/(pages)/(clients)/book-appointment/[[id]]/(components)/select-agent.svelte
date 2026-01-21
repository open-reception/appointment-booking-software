<script lang="ts">
  import { browser } from "$app/environment";
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { LocalizedText } from "$lib/components/ui/public";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public.js";
  import type { TPublicAgent, TPublicAppointment } from "$lib/types/public.js";
  import { cn } from "$lib/utils";
  import UnknownItemIcon from "@lucide/svelte/icons/user-star";

  const {
    channel,
    proceed,
  }: { channel: string; proceed: (a: Partial<TPublicAppointment>) => void } = $props();

  const appointment = $derived($publicStore.newAppointment);
  let agents: TPublicAgent[] | undefined = $state(undefined);
  let firstAgents: TPublicAgent[] = $derived(
    agents
      ? ([...agents] as TPublicAgent[])
          .sort((a, b) => {
            if (a.image && !b.image) return 1;
            if (!a.image && b.image) return -1;
            return 1;
          })
          .slice(0, 3)
      : [],
  );

  $effect(() => {
    fetchAgents();
  });

  $effect(() => {
    if (agents && agents.length === 1) {
      selectAgent(agents[0]);
    }
  });

  const fetchAgents = async () => {
    if (!browser) return;

    const res = await fetch(`/api/public/channels/${channel}/agents`, {
      method: "GET",
    });

    if (res.status < 400) {
      try {
        const data = await res.json();
        agents = data.agents;
      } catch (error) {
        console.error("Unable to parse public agents response", error);
      }
    } else {
      console.error("Invalid public agents response");
    }
  };

  const selectAgent = (agent: TPublicAgent | null) => {
    proceed({
      ...appointment,
      agent: agent
        ? {
            id: agent.id,
            name: agent.name,
            image: agent.image,
          }
        : null,
    });
  };

  const getLeft = () => {
    return firstAgents.length === 3 ? `left-2.5` : `left-0`;
  };
</script>

<div class="flex flex-col gap-4 pb-1">
  <Text style="sm" class="font-medium">
    {m["public.steps.agent.title"]()}
  </Text>
  <ul class="flex flex-col gap-2">
    {#if agents}
      <li class="mb-3">
        <Button
          variant="outline"
          class="hover:border-primary/30 flex h-auto w-full cursor-pointer items-start gap-9 px-3 py-2.5 text-left"
          onclick={() => selectAgent(null)}
        >
          <div class="relative size-10">
            {#each firstAgents as agent, index (`images-${agent.id}`)}
              <div
                class={cn(
                  "absolute top-0 z-1 size-10 overflow-visible",
                  index === 0 && `left-5`,
                  index === 1 && getLeft(),
                  index === 2 && `left-0`,
                )}
              >
                {#if agent.image}
                  <img
                    src={agent.image}
                    alt={agent.name}
                    class="size-10 rounded-full border object-cover object-center"
                    loading="lazy"
                  />
                {:else}
                  <UnknownItemIcon
                    class="bg-muted text-muted-foreground size-10 rounded-full border stroke-1 p-1"
                  />
                {/if}
              </div>
            {/each}
          </div>
          <div class="flex grow flex-col gap-1">
            <Text style="md" class="font-medium">
              {m["public.steps.agent.anyone.title"]()}
            </Text>
            <Text style="md" class="text-muted-foreground font-normal whitespace-pre-line">
              {m["public.steps.agent.anyone.description"]()}
            </Text>
          </div>
        </Button>
      </li>
      {#each agents as agent (agent.id)}
        <li>
          <Button
            variant="outline"
            class="flex h-auto w-full cursor-pointer items-start gap-4 px-3 py-2.5 text-left"
            onclick={() => selectAgent(agent)}
          >
            {#if agent.image}
              <img
                src={agent.image}
                alt={agent.name}
                class="size-15 rounded-full border object-cover object-center"
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
              <Text style="md" class="text-muted-foreground font-normal whitespace-pre-line">
                <LocalizedText translations={agent.descriptions} />
              </Text>
            </div>
          </Button>
        </li>
      {/each}
    {:else}
      <div class="flex flex-col gap-2">
        <Skeleton class="h-21 w-full opacity-65" />
        <Skeleton class="h-21 w-full opacity-50" />
        <Skeleton class="h-21 w-full opacity-35" />
      </div>
    {/if}
  </ul>
</div>
