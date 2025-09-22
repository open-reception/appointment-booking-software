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
  import { tenants as tenantsStore } from "$lib/stores/tenants";
  import { type TTenant } from "$lib/types/tenant";
  import EditIcon from "@lucide/svelte/icons/pencil";
  import SelectIcon from "@lucide/svelte/icons/plug-zap";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import UnknownItemIcon from "@lucide/svelte/icons/ticket-x";
  import DeleteIcon from "@lucide/svelte/icons/trash-2";
  import { onMount } from "svelte";
  import { AddTenantForm } from "./(components)/add-tenant-form";
  import DeleteTenantForm from "./(components)/delete-tenant-form/delete-tenant-form.svelte";
  import EditTenantForm from "./(components)/edit-tenant-form/edit-tenant-form.svelte";

  const { data } = $props();
  let curItem: TTenant | null = $state(null);

  onMount(() => {
    if (history.state["sveltekit:states"]?.action === "add") {
      openDialog("add");
      history.replaceState({}, "");
    }
  });
</script>

<svelte:head>
  <title>{m["tenants.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.tenants"](),
      href: ROUTES.DASHBOARD.TENANTS,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    {#await data.streamed.list as TTenant[]}
      <LoadingList title={m["tenants.loading"]()} />
    {:then items}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add"
          title={m["tenants.add.title"]()}
          description={m["tenants.add.description"]()}
          triggerHidden={items.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["tenants.add.title"]()}
          {/snippet}
          <AddTenantForm
            {data}
            done={() => {
              invalidate(ROUTES.DASHBOARD.TENANTS);
              tenantsStore.reload();
              closeDialog("add");
            }}
          />
        </ResponsiveDialog>

        {#if items.length > 0}
          <List>
            {#each items as item (item.id)}
              <ListItem
                title={item.shortName}
                description={`${item.shortName}.${window.location.hostname}`}
                descriptionOnClick={() =>
                  window.open(
                    `https://${item.shortName}.${window.location.hostname}`,
                    "_blank",
                    "noopener,noreferrer",
                  )}
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
                    icon: SelectIcon,
                    label: m["select"](),
                    onClick: () => tenantsStore.setCurrentTenant(item.id, true),
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
                {item.shortName}
              </ListItem>
            {/each}
          </List>
          <ResponsiveDialog
            id="edit"
            title={m["tenants.edit.title"]()}
            description={m["tenants.edit.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              <EditTenantForm
                entity={curItem}
                done={() => {
                  closeDialog("edit");
                  curItem = null;
                  invalidate(ROUTES.DASHBOARD.TENANTS);
                }}
              />
            {/if}
          </ResponsiveDialog>
          <ResponsiveDialog id="delete" title={m["tenants.delete.title"]()} triggerHidden={true}>
            {#if curItem}
              <DeleteTenantForm
                entity={curItem}
                done={() => {
                  closeDialog("delete");
                  curItem = null;
                  tenantsStore.reload();
                  invalidate(ROUTES.DASHBOARD.TENANTS);
                }}
              />
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UnknownItemIcon}
              headline={m["tenants.empty.title"]()}
              description={m["tenants.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add")}>
              <PlusIcon />
              {m["tenants.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
