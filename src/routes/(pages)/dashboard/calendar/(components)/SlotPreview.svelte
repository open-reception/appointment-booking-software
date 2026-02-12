<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { calendarStore } from "$lib/stores/calendar";
  import { channels as channelsStore } from "$lib/stores/channels";
  import { type TCalendarItem } from "$lib/types/calendar";
  import { calendarItemToDate, toDisplayDateTime } from "$lib/utils/datetime";
  import { getCurrentTranlslation } from "$lib/utils/localizations";

  let {
    item,
  }: {
    item: TCalendarItem;
  } = $props();

  let channel = $derived(
    $channelsStore.channels.filter((x) => !x.archived).find((x) => x.id === item.channelId),
  );

  const setCalendarItem = () => {
    calendarStore.setCurSlot(item);
  };
</script>

<Button
  class="m-0 h-full w-full cursor-pointer justify-start rounded-none px-1 leading-none text-(--channel-color-contrast) hover:bg-transparent! hover:text-(--channel-color-contrast) focus:ring-1"
  variant="ghost"
  onclick={setCalendarItem}
>
  <span class="sr-only">
    {m["calendar.addAppointment.preview"]({
      time: toDisplayDateTime(calendarItemToDate(item), {
        hour: "2-digit",
        minute: "2-digit",
      }),
      channel: channel ? getCurrentTranlslation(channel.names) : "unkown channel",
    })}
  </span>
</Button>
