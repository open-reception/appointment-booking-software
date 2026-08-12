<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { AppointmentDetails } from "$lib/components/ui/appointment-details";
  import { Button } from "$lib/components/ui/button";
  import { type SupportedLocale } from "$lib/const/locales";
  import { type CurAppointmentItem } from "$lib/stores/calendar";
  import type { TAppointmentFilter, TCalendarMode } from "$lib/types/calendar";
  import { channels as channelsStore } from "$lib/stores/channels";
  import { Calendar, Trash2 } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { cancelAppointment, confirmAppointment, denyAppointment } from "./utils";
  import { ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { getCurrentTranlslation } from "$lib/utils/localizations";

  let {
    tenantId,
    mode = $bindable(),
    item = $bindable(),
    shownAppointments = $bindable(),
    shownChannels = $bindable(),
    updateCalendar,
    close,
  }: {
    tenantId: string;
    mode: TCalendarMode;
    item: CurAppointmentItem;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    updateCalendar: () => void;
    close: () => void;
  } = $props();

  const channels = $derived($channelsStore.channels);
  const channel = $derived.by(() => channels.find((c) => c.id === item.appointment.channelId));
  let agents = $derived($agentsStore.agents);
  let agent = $derived.by(() => agents.find((a) => a.id === item.appointment.appointment?.agentId));
  let isConfirming = $state(false);
  let isDenying = $state(false);
  let isDeleting = $state(false);

  const denyItem = async () => {
    const proceed = confirm(
      `${m["calendar.notificationHint"]()} ${m["calendar.denyAppointment.confirm"]()}`,
    );
    if (!proceed) return;

    isDenying = true;
    const success = await denyAppointment({
      tenant: tenantId,
      appointment: item.appointment.id,
      email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
      locale: item.decrypted.locale || "en",
    });
    if (success) {
      toast.success(m["calendar.denyAppointment.success"]());
      updateCalendar();
      close();
    } else {
      toast.error(m["calendar.denyAppointment.error"]());
    }
    isDenying = false;
  };

  const confirmItem = async () => {
    isConfirming = true;
    const success = await confirmAppointment({
      tenant: tenantId,
      appointment: item.appointment.id,
      email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
      locale: item.decrypted.locale || getLocale(),
    });
    if (success) {
      toast.success(m["calendar.confirmAppointment.success"]());
      updateCalendar();
      close();
    } else {
      toast.error(m["calendar.confirmAppointment.error"]());
    }
    isConfirming = false;
  };
</script>

<ResponsiveDialog
  id="current-calendar-item"
  title={agent?.name || "unkown agent"}
  description={channel ? getCurrentTranlslation(channel.names) : undefined}
  triggerHidden={true}
  isActionLoading={isDeleting}
  actions={[
    {
      type: "action",
      label: m["calendar.moveAppointment.action"](),
      icon: Calendar,
      onClick: () => {
        mode = {
          mode: "MOVE",
          channelId: item.appointment.channelId,
          appointmentId: item.appointment.id,
          agentId: item.appointment.appointment?.agentId,
          appointment: {
            email: item.decrypted.email,
            shareEmail: item.decrypted.shareEmail,
            dateTime: item.appointment.appointment?.dateTime,
            hasNoEmail: Boolean(item.decrypted.email), // TODO:
            phone: item.decrypted.phone,
            name: item.decrypted.name,
            locale: item.decrypted.locale || getLocale(),
          },
        };
        shownAppointments = "available";
        shownChannels = [item.appointment.channelId];
        close();
      },
    },
    {
      type: "divider",
    },
    {
      type: "action",
      isDestructive: true,
      label: m["calendar.cancelAppointment.action"](),
      icon: Trash2,
      onClick: async () => {
        const proceed = confirm(
          `${m["calendar.notificationHint"]()} ${m["calendar.cancelAppointment.confirm"]()}`,
        );
        if (!proceed) return;

        isDeleting = true;
        const success = await cancelAppointment({
          tenant: tenantId,
          appointment: item.appointment.id,
          email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
          locale: item.decrypted.locale || "en",
        });
        if (success) {
          toast.success(m["calendar.cancelAppointment.success"]());
          updateCalendar();
          close();
        } else {
          toast.error(m["calendar.cancelAppointment.error"]());
        }
        isDeleting = false;
      },
    },
  ]}
>
  {#if item.appointment.appointment}
    <div class="flex flex-col items-start gap-2">
      <AppointmentDetails
        items={[
          {
            type: "client-name",
            value: item.decrypted.name,
          },
          {
            type: "client-locale",
            value: item.decrypted.locale as SupportedLocale,
          },
          {
            type: "client-email",
            value: item.decrypted.email,
          },
          {
            type: "client-phone",
            value: item.decrypted.phone,
          },
          {
            type: "date",
            value: item.appointment.appointment.dateTime,
          },
        ]}
      />
      {#if item.appointment.status === "reserved"}
        <div class="mt-5 flex flex-col gap-2">
          <Button
            class="w-full"
            disabled={isConfirming || isDenying}
            isLoading={isConfirming}
            onclick={confirmItem}
          >
            {m["calendar.confirmAppointment.action"]()}
          </Button>
          <Button
            class="w-full"
            disabled={isConfirming || isDenying}
            isLoading={isConfirming}
            variant="destructive"
            onclick={denyItem}
          >
            {m["calendar.denyAppointment.action"]()}
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</ResponsiveDialog>
