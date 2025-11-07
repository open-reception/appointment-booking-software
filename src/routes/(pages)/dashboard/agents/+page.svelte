<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import EmptyState from "$lib/components/templates/empty-state/center-state.svelte";
  import { List, ListItem } from "$lib/components/templates/list";
  import { LoadingList } from "$lib/components/templates/loading";
  import { Button } from "$lib/components/ui/button";
  import { ResponsiveDialog, closeDialog, openDialog } from "$lib/components/ui/responsive-dialog";
  import { ROUTES } from "$lib/const/routes";
  import { agents } from "$lib/stores/agents";
  import { type TAgent } from "$lib/types/agent";
  import EditIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import DeleteIcon from "@lucide/svelte/icons/trash-2";
  import UnknownItemIcon from "@lucide/svelte/icons/user-star";
  import { onMount } from "svelte";
  import { AddAgentForm } from "./(components)/add-agent-form";
  import { DeleteAgentForm } from "./(components)/delete-agent-form";
  import { EditAgentForm } from "./(components)/edit-agent-form";
  import { channels } from "$lib/stores/channels";

  const { data } = $props();
  let curItem: TAgent | null = $state(null);

  onMount(() => {
    if (history.state["sveltekit:states"]?.action === "add") {
      openDialog("add");
      history.replaceState({}, "");
    }
  });
</script>

<svelte:head>
  <title>{m["agents.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.agents"](),
      href: ROUTES.DASHBOARD.AGENTS,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    {#await data.streamed.list as TAgent[]}
      <LoadingList title={m["agents.loading"]()} />
    {:then items}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add"
          title={m["agents.add.title"]()}
          description={m["agents.add.description"]()}
          triggerHidden={items.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["agents.add.title"]()}
          {/snippet}
          <AddAgentForm
            done={() => {
              agents.load();
              channels.load();
              invalidate(ROUTES.DASHBOARD.AGENTS);
              closeDialog("add");
            }}
          />
        </ResponsiveDialog>

        {#if items.length > 0}
          <List>
            {#each items as item (item.id)}
              <ListItem
                image={item.image || UnknownItemIcon}
                title={item.name}
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
              >
                {item.name}
              </ListItem>
            {/each}
          </List>
          <ResponsiveDialog
            id="edit"
            title={m["agents.edit.title"]()}
            description={m["agents.edit.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              <EditAgentForm
                entity={curItem}
                done={() => {
                  closeDialog("edit");
                  curItem = null;
                  agents.load();
                  channels.load();
                  invalidate(ROUTES.DASHBOARD.AGENTS);
                }}
              />
            {/if}
          </ResponsiveDialog>
          <ResponsiveDialog id="delete" title={m["agents.delete.title"]()} triggerHidden={true}>
            {#if curItem}
              <DeleteAgentForm
                entity={curItem}
                done={() => {
                  closeDialog("delete");
                  curItem = null;
                  agents.load();
                  channels.load();
                  invalidate(ROUTES.DASHBOARD.AGENTS);
                }}
              />
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UnknownItemIcon}
              headline={m["agents.empty.title"]()}
              description={m["agents.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add")}>
              <PlusIcon />
              {m["agents.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
