<script lang="ts">
  import { m } from "$i18n/messages";
  import { Badge } from "$lib/components/ui/badge";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { notifications as notificationsStore } from "$lib/stores/notifications";
  import { cn } from "$lib/utils";
  import { Bell, Check, CheckCheck, X } from "@lucide/svelte/icons";
  import { toast } from "svelte-sonner";
  import NotificationItem from "./notification-item.svelte";

  const notifications = $derived($notificationsStore.notifications);
  let open = $state(false);

  const onOpenChange = (value: boolean) => {
    open = value;
  };

  const deleteAll = async () => {
    const success = await notificationsStore.deleteAll();

    if (success) {
      open = false;
      toast.success(m["notifications.markAllAsRead.success"]());
    } else {
      toast.error(m["notifications.markAllAsRead.error"]());
    }
  };
</script>

<Popover.Root {open} {onOpenChange}>
  <Popover.Trigger
    class={cn(buttonVariants({ variant: "ghost" }), "relative size-7 px-px")}
    title={m["notifications.title"]()}
  >
    <Bell />
    {#if notifications.length > 0}
      <Badge
        class="dark:bg-destructive absolute -top-px -right-0.5 h-4 min-w-4 rounded-full px-1 font-mono text-[0.5rem] tabular-nums"
        variant="destructive"
      >
        {notifications.length > 99 ? "99+" : notifications.length}
      </Badge>
    {/if}
  </Popover.Trigger>
  <Popover.Content align="start" class="ml-1 max-h-[90dvh] w-80 p-0">
    <div class="grid">
      <div class="flex items-center justify-between rounded-t-md border-b p-3 pr-2">
        <Headline level="h4" style="h5">{m["notifications.title"]()}</Headline>
        <div>
          {#if notifications.length > 0}
            <Button
              variant="ghost"
              size="sm"
              title={m["notifications.markAllAsRead.action"]()}
              onclick={deleteAll}
              class="h-auto! p-1!"
            >
              <CheckCheck class="size-4" />
              <span class="sr-only">{m["notifications.markAllAsRead.action"]()}</span>
            </Button>
          {/if}
          <Popover.Close
            title={m["close"]()}
            class="hover:bg-accent dark:hover:bg-accent/50 rounded-md p-1! focus:outline-3"
          >
            <X class="size-4" />
            <span class="sr-only">{m["close"]()}</span>
          </Popover.Close>
        </div>
      </div>
      <ScrollArea class="max-h-100">
        {#if notifications.length === 0}
          <div class="flex h-32 w-full items-center justify-center px-3 text-center">
            <Text style="md" class="text-muted-foreground">{m["notifications.empty"]()}</Text>
          </div>
        {/if}
        {#each notifications as notification (notification.id)}
          <div class="[&+&]:border-t-muted relative [&+&]:border-t">
            <NotificationItem item={notification} />
            <Button
              variant="ghost"
              class="absolute top-1.5 right-1.5 rounded-md p-1!"
              size="xs"
              title={m["notifications.markAsRead"]()}
              onclick={() => notificationsStore.delete(notification.id)}
            >
              <Check class="size-4" />
              <span class="sr-only">{m["notifications.markAsRead"]()}</span>
            </Button>
          </div>
        {/each}
      </ScrollArea>
    </div>
  </Popover.Content>
</Popover.Root>
