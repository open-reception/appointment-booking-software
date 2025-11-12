<script lang="ts">
  import { browser } from "$app/environment";
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import * as Calendar from "$lib/components/ui/calendar";
  import * as Card from "$lib/components/ui/card";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public.js";
  import type { TPublicAppointment, TPublicSchedule, TPublicSlot } from "$lib/types/public.js";
  import {
    CalendarDate,
    getLocalTimeZone,
    parseDate,
    toCalendarDate,
    toCalendarDateTime,
    today,
    type DateValue,
  } from "@internationalized/date";
  import Loader from "@lucide/svelte/icons/loader-2";
  import type { DateMatcher } from "bits-ui";
  import type { OnChangeFn } from "vaul-svelte";
  import { fetchSchedule } from "./utils";

  const {
    channel,
    agent,
    proceed,
  }: {
    channel: string;
    agent: TPublicAppointment["agent"] | null;
    proceed: (a: Partial<TPublicAppointment>) => void;
  } = $props();

  const tenant = $derived($publicStore.tenant);
  const appointment = $derived($publicStore.newAppointment);
  let schedule: TPublicSchedule["schedule"] | undefined = $state(undefined);
  let selectedDate = $state<CalendarDate | undefined>(today(getLocalTimeZone()));
  // Slots for selected date
  // null = select date first, undefined = loading, TPublicSlot[] = slots
  let slots = $state<TPublicSlot[] | undefined | null>(null);
  let year = $state<number>(today(getLocalTimeZone()).year);
  let month = $state<number>(today(getLocalTimeZone()).month);
  let scrollAreaRef: HTMLDivElement | null = $state(null);

  const scrollToTop = () => {
    scrollAreaRef?.firstElementChild?.scrollTo({ top: 0, behavior: "smooth" });
  };

  $effect(() => {
    if (tenant) {
      loadMonthlySchedule(tenant.id, year, month);
    }
  });

  const loadMonthlySchedule = (tenant: string, year: number, month: number) => {
    slots = undefined;
    fetchSchedule({ tenant, channel, agent: agent?.id ?? null, year, month }).then((data) => {
      if (data) {
        slots = null;
        schedule = data;
        const firstItem = data[0];
        if (firstItem) {
          const parsedDate = parseDate(firstItem.date);
          onSelectDay(parsedDate);
          if (selectedDate?.toString() !== firstItem.date) {
            selectedDate = toCalendarDate(parsedDate);
          }
        }
      } else {
        schedule = [];
        slots = [];
      }
    });
  };

  const setToToday = () => {
    if (browser) {
      const todayDate = today(getLocalTimeZone());
      year = todayDate.year;
      month = todayDate.month;
      selectedDate = new CalendarDate(todayDate.year, todayDate.month, todayDate.day);
    }
  };

  const onSelectDay: OnChangeFn<DateValue | undefined> = (date) => {
    if (!date) {
      slots = undefined;
      return;
    }
    const newSlots = getSlots(toCalendarDate(date));
    slots = newSlots;
    scrollToTop();
  };

  const getSlots = (date: CalendarDate) => {
    if (!schedule || schedule.length === 0) return undefined;
    const dateStr = date.toString();
    const curDateStr = today(getLocalTimeZone()).toString();
    const dateSchedule = schedule.find((s) => s.date === dateStr);
    // @ts-expect-error typing of channelId not definitive enough
    const slots = (dateSchedule?.channels[channel].availableSlots || []) as TPublicSlot[];

    // If selected date is today, filter out slots that are already past
    const filteredSlots =
      curDateStr === dateStr
        ? slots.filter((slot) => {
            if (dateStr === curDateStr) {
              const now = new Date();
              const slotTime = new Date(
                date.year,
                date.month - 1,
                date.day,
                parseInt(slot.from.split(":")[0], 10),
                parseInt(slot.from.split(":")[1], 10),
              );
              return slotTime > now;
            }
            return true;
          })
        : slots;

    return filteredSlots;
  };

  const isDateUnavailable: DateMatcher = (date) => {
    if (!schedule || schedule.length === 0) return true;
    const slots = getSlots(toCalendarDate(date));
    if (slots && slots.length > 0) return false;
    return true;
  };

  const selectSlot = (slot: TPublicSlot) => {
    if (selectedDate && slot.availableAgents.length > 0) {
      proceed({
        ...appointment,
        agent: {
          id: slot.availableAgents[0].id,
          name: slot.availableAgents[0].name,
          image: slot.availableAgents[0].image || null,
        },
        slot: {
          datetime: toCalendarDateTime(selectedDate).set({
            hour: parseInt(slot.from.split(":")[0], 10),
            minute: parseInt(slot.from.split(":")[1], 10),
          }),
        },
      });
    }
  };
</script>

<div class="flex flex-col gap-4 pb-1">
  <Text style="sm" class="font-medium">
    {m["public.steps.slot.title"]()}
  </Text>
  <Card.Root class="flex flex-col gap-4 rounded-lg border shadow-sm">
    <div class="flex gap-3">
      <Button
        size="sm"
        variant="outline"
        onclick={setToToday}
        disabled={selectedDate?.toString() === today(getLocalTimeZone()).toString()}
      >
        {m["public.steps.slot.today"]()}
      </Button>
      {#if schedule === undefined}{/if}
    </div>
    <div class="flex flex-col gap-4 md:flex-row">
      <Calendar.Calendar
        type="single"
        locale={getLocale()}
        calendarLabel="Select a date"
        bind:value={selectedDate}
        {isDateUnavailable}
        class="rounded-lg p-0 [&_td]:grow [&_td_*]:mx-auto [&_th]:grow"
        preventDeselect={true}
        disableDaysOutsideMonth={true}
        onValueChange={onSelectDay}
        onPlaceholderChange={(placeholder) => {
          if (!placeholder) return;
          if (placeholder.year === year && placeholder.month === month) return;
          year = placeholder.year;
          month = placeholder.month;
          schedule = undefined;
        }}
      />
      <div class="flex grow items-center justify-center p-4 px-6">
        {#if slots === null}
          <Text style="md" class="text-muted-foreground text-center">
            {m["public.steps.slot.selectDate"]()}
          </Text>
        {:else if slots === undefined}
          <div class="flex flex-col items-center gap-1">
            <Loader
              class="text-muted-foreground mx-auto mb-3 size-5 animate-spin"
              strokeWidth={1}
            />
            <Text style="md" class="text-muted-foreground text-center">
              {m["public.steps.slot.loading"]()}
            </Text>
          </div>
        {:else if slots.length === 0}
          <Text style="md" class="text-muted-foreground text-center">
            {m["public.steps.slot.empty"]()}
          </Text>
        {:else}
          <ScrollArea bind:ref={scrollAreaRef} class="w-full md:h-65">
            <div class="flex h-full flex-col gap-3">
              <Text style="md" class="text-muted-foreground text-center">
                {m["public.steps.slot.selectTime"]()}
              </Text>
              {#each slots as slot (slot.from)}
                <Button onclick={() => selectSlot(slot)} class="w-full">{slot.from}</Button>
              {/each}
            </div>
          </ScrollArea>
        {/if}
      </div>
    </div>
  </Card.Root>
</div>
