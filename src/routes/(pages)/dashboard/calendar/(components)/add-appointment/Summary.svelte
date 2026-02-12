<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { Calendar, Mail, Phone, User, UserStar } from "@lucide/svelte";
  import type { TAddAppointment, TAddAppointmentStep } from "./types";

  let {
    step,
    newAppointment,
  }: {
    step: TAddAppointmentStep;
    newAppointment: TAddAppointment;
  } = $props();

  let agent = $derived($agentsStore.agents.find((a) => a.id === newAppointment.agentId));
</script>

<div class="flex flex-col items-start gap-3">
  <div class="flex gap-2">
    <Calendar class="size-4 " />
    <Text style="sm">
      {toDisplayDateTime(newAppointment.dateTime, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </Text>
  </div>
  {#if newAppointment.name}
    <div class="flex gap-2">
      <User class="size-4 " />
      <Text style="sm">
        {newAppointment.name}
      </Text>
    </div>
  {/if}
  {#if newAppointment.email}
    <Button
      class="h-auto w-auto justify-start gap-2 rounded-sm p-1"
      variant="link"
      href={`mailto:${newAppointment.email}`}
    >
      <Mail class="size-4 " />
      {newAppointment.email}
    </Button>
  {/if}
  {#if newAppointment.phone}
    <Button
      class="h-auto w-auto justify-start gap-2 rounded-sm p-1"
      variant="link"
      href={`tel:${newAppointment.phone}`}
    >
      <Phone class="size-4 " />
      {newAppointment.phone}
    </Button>
  {/if}
  {#if agent}
    <div class="flex gap-2">
      <UserStar class="size-4 " />
      <Text style="sm">
        {agent.name}
      </Text>
    </div>
  {/if}
</div>
<div class="my-5">
  {#if step !== "summary"}
    <Separator />
  {/if}
</div>
