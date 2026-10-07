<script lang="ts">
  import { page } from "$app/state";
  import { m } from "$i18n/messages";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { Separator } from "$lib/components/ui/separator";
  import { type SelectAppointmentProgress } from "$lib/server/db/tenant-schema";
  import { type CurAppointmentItem } from "$lib/stores/calendar";
  import { Loader2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import AppointmentProgressItem from "./AppointmentProgressItem.svelte";
  import { isShowingAppointmentProgress, progressAppointment } from "./utils";

  let {
    tenantId,
    item = $bindable(),
    updateCalendar,
  }: {
    tenantId: string;
    item: CurAppointmentItem;
    updateCalendar: () => void;
  } = $props();

  let curState = $state(item.appointment.progress || "UNKNOWN");
  let isSubmitting = $state(false);

  const onChange = async () => {
    isSubmitting = true;

    const success = await progressAppointment({
      tenant: tenantId,
      appointment: item.appointment.id,
      progress: curState,
    });
    if (success) {
      // Update the local item, so all re-renders show the new value
      item = { ...item, appointment: { ...item.appointment, progress: curState } };

      updateCalendar();
    } else {
      toast.error(m["calendar.progressAppointment.error"]());
    }

    isSubmitting = false;
  };
</script>

{#if isShowingAppointmentProgress(item.appointment.status, item.appointment.appointment?.dateTime)}
  {#await page.data.streamed.progressStates as Promise<SelectAppointmentProgress[]> then progressStates}
    {#if progressStates.length > 0}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class={buttonVariants({ variant: "outline", class: "mt-5 w-full" })}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <Loader2 class="animate-spin" />
          {:else}
            {@const curProgress = progressStates.find(
              (ps) => ps.state === item.appointment.progress,
            )}
            {#if curProgress}
              <AppointmentProgressItem state={curProgress} />
            {:else}
              Select Progress
            {/if}
          {/if}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="min-w-56">
          <DropdownMenu.RadioGroup bind:value={curState} onValueChange={onChange}>
            {@const groups = progressStates
              .sort((a, b) => {
                const groups = ["NOT_STARTED", "WAITING", "IN_PROGRESS", "DONE", "UNKNOWN"];
                const indexA = groups.indexOf(a.group);
                const indexB = groups.indexOf(b.group);
                if (indexA === indexB) return 0;
                return indexA - indexB;
              })
              .reduce(
                (list, item) => {
                  if (!list[item.group]) list[item.group] = [];
                  list[item.group].push(item);
                  return list;
                },
                {} as Record<string, SelectAppointmentProgress[]>,
              )}
            {#each Object.keys(groups) as group, index (group)}
              {#each Object.values(groups[group]) as progressState (progressState.id)}
                <DropdownMenu.RadioItem value={progressState.state}>
                  <AppointmentProgressItem state={progressState} />
                </DropdownMenu.RadioItem>
              {/each}
              {#if index < Object.keys(groups).length - 1}
                <Separator />
              {/if}
            {/each}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {/if}
  {/await}
{/if}
