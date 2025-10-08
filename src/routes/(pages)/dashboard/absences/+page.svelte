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
  import { agents as agentsStore } from "$lib/stores/agents";
  import { type TAbsence } from "$lib/types/absence";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import EditIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import DeleteIcon from "@lucide/svelte/icons/trash-2";
  import UnknownItemIcon from "@lucide/svelte/icons/tree-palm";
  import { onMount } from "svelte";
  import { AddAbsenceForm } from "./(components)/add-absence-form";
  import { DeleteAbsenceForm } from "./(components)/delete-absence-form";
  import EditAbsenceForm from "./(components)/edit-absence-form/edit-absence-form.svelte";
  import { reasons } from "./(components)/utils";

  const { data } = $props();
  const agents = $derived($agentsStore.agents ?? []);
  let curItem: TAbsence | null = $state(null);

  onMount(() => {
    if (history.state["sveltekit:states"]?.action === "add") {
      openDialog("add");
      history.replaceState({}, "");
    }
  });

  const renderDescription = (item: TAbsence) => {
    const startDate = toDisplayDateTime(new Date(item.startDate));
    const endDate = toDisplayDateTime(new Date(item.endDate));
    const reason = reasons.find((r) => r.value === item.absenceType);
    return `${reason?.label}: ${startDate === endDate ? startDate : `${startDate} - ${endDate}`}`;
  };
</script>

<svelte:head>
  <title>{m["absences.title"]()} - OpenReception</title>
</svelte:head>
<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.absences"](),
      href: ROUTES.DASHBOARD.ABSENCES,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    {#await data.streamed.list as TAbsence[]}
      <LoadingList title={m["absences.loading"]()} />
    {:then items}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add"
          title={m["absences.add.title"]()}
          description={m["absences.add.description"]()}
          triggerHidden={items.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["absences.add.title"]()}
          {/snippet}
          <AddAbsenceForm
            done={() => {
              invalidate(ROUTES.DASHBOARD.ABSENCES);
              closeDialog("add");
            }}
          />
        </ResponsiveDialog>
        {#if items.length > 0}
          <List>
            {#each items as item (item.id)}
              {@const agent = agents.find((a) => a.id === item.agentId)}
              <ListItem
                title={agent?.name || item.agentId}
                image={agent?.image || UnknownItemIcon}
                description={renderDescription(item)}
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
                {agent?.name || item.agentId}
              </ListItem>
            {/each}
          </List>
          <ResponsiveDialog
            id="edit"
            title={m["absences.edit.title"]()}
            description={m["absences.edit.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              <EditAbsenceForm
                entity={curItem}
                done={() => {
                  closeDialog("edit");
                  curItem = null;
                  invalidate(ROUTES.DASHBOARD.ABSENCES);
                }}
              />
            {/if}
          </ResponsiveDialog>
          <ResponsiveDialog id="delete" title={m["absences.delete.title"]()} triggerHidden={true}>
            {#if curItem}
              <DeleteAbsenceForm
                entity={curItem}
                done={() => {
                  closeDialog("delete");
                  curItem = null;
                  invalidate(ROUTES.DASHBOARD.ABSENCES);
                }}
              />
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UnknownItemIcon}
              headline={m["absences.list.empty.title"]()}
              description={m["absences.list.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add")}>
              <PlusIcon />
              {m["absences.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
