<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import EmptyState from "$lib/components/templates/empty-state/center-state.svelte";
  import { List, ListItem } from "$lib/components/templates/list";
  import { LoadingList } from "$lib/components/templates/loading";
  import { Button } from "$lib/components/ui/button";
  import { ResponsiveDialog, closeDialog, openDialog } from "$lib/components/ui/responsive-dialog";
  import { ROUTES } from "$lib/const/routes";
  import { tenants } from "$lib/stores/tenants";
  import { type TChannelWithFullAgents } from "$lib/types/channel";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import EditIcon from "@lucide/svelte/icons/pencil";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import UnknownItemIcon from "@lucide/svelte/icons/split";
  import DeleteIcon from "@lucide/svelte/icons/trash-2";
  import { onMount } from "svelte";
  import { AddChannelForm } from "./(components)/add-channel-form";
  import DeleteChannelForm from "./(components)/delete-channel-form/delete-channel-form.svelte";
  import EditChannelForm from "./(components)/edit-channel-form/edit-channel-form.svelte";
  import { PauseChannelForm } from "./(components)/pause-channel-form";
  import { channels } from "$lib/stores/channels";

  const { data } = $props();
  let curItem: TChannelWithFullAgents | null = $state(null);

  onMount(() => {
    if (history.state["sveltekit:states"]?.action === "add") {
      openDialog("add");
      history.replaceState({}, "");
    }
  });
</script>

<svelte:head>
  <title>{m["channels.title"]()} - OpenReception</title>
</svelte:head>
<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.channels"](),
      href: ROUTES.DASHBOARD.CHANNELS,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    {#await data.streamed.list as TChannelWithFullAgents[]}
      <LoadingList title={m["channels.loading"]()} />
    {:then items}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add"
          title={m["channels.add.title"]()}
          description={m["channels.add.description"]()}
          triggerHidden={items.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["channels.add.title"]()}
          {/snippet}
          <AddChannelForm
            done={() => {
              tenants.reload();
              channels.load();
              closeDialog("add");
            }}
          />
        </ResponsiveDialog>
        {#if items.length > 0}
          <List>
            {#each items as item (item.id)}
              {@const name = getCurrentTranlslation(item.names)}
              <ListItem
                title={name}
                actions={[
                  {
                    type: "action",
                    icon: EditIcon,
                    label: m["edit"](),
                    onClick: () => {
                      curItem = item;
                      openDialog("edit");
                    },
                  },
                  {
                    type: "action",
                    icon: item.pause ? PlayIcon : PauseIcon,
                    label: item.pause ? m["unpause"]() : m["pause"](),
                    onClick: () => {
                      curItem = item;
                      openDialog("pause");
                    },
                  },
                  {
                    type: "divider",
                  },
                  {
                    type: "action",
                    icon: DeleteIcon,
                    label: m["delete"](),
                    isDestructive: true,
                    onClick: () => {
                      curItem = item;
                      openDialog("delete");
                    },
                  },
                ]}
                badges={item.pause
                  ? [{ label: m["channels.list.badges.paused"](), variant: "outline" }]
                  : []}
              >
                {name}
              </ListItem>
            {/each}
          </List>
          <ResponsiveDialog
            id="edit"
            title={m["channels.edit.title"]()}
            description={m["channels.edit.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              <EditChannelForm
                entity={curItem}
                done={() => {
                  closeDialog("edit");
                  curItem = null;
                  channels.load();
                }}
              />
            {/if}
          </ResponsiveDialog>
          {#if curItem}
            <ResponsiveDialog
              id="pause"
              title={curItem?.pause ? m["channels.unpause.title"]() : m["channels.pause.title"]()}
              triggerHidden={true}
            >
              <PauseChannelForm
                entity={curItem}
                done={() => {
                  closeDialog("pause");
                  curItem = null;
                  channels.load();
                }}
              />
            </ResponsiveDialog>
          {/if}
          <ResponsiveDialog id="delete" title={m["channels.delete.title"]()} triggerHidden={true}>
            {#if curItem}
              <DeleteChannelForm
                entity={curItem}
                done={() => {
                  closeDialog("delete");
                  curItem = null;
                  tenants.reload();
                  channels.load();
                }}
              />
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UnknownItemIcon}
              headline={m["channels.empty.title"]()}
              description={m["channels.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add")}>
              <PlusIcon />
              {m["channels.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
