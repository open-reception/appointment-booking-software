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
  import { type TTenant } from "$lib/types/tenant";
  import SelectIcon from "@lucide/svelte/icons/plug-zap";
  import EditIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import UnknownTenantIcon from "@lucide/svelte/icons/ticket-x";
  import DeleteIcon from "@lucide/svelte/icons/trash-2";
  import { AddTenantForm } from "./(components)/add-tenant-form";
  import { tenants as tenantsStore } from "$lib/stores/tenants";
  import DeleteTenantForm from "./(components)/delete-tenant-form/delete-tenant-form.svelte";

  const { data } = $props();
  let curTenant: TTenant | null = $state(null);
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
    {:then tenants}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add-tenant"
          title={m["tenants.add.title"]()}
          description={m["tenants.add.description"]()}
          triggerHidden={tenants.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["tenants.add.title"]()}
          {/snippet}
          <AddTenantForm
            {data}
            done={() => {
              invalidate(ROUTES.DASHBOARD.TENANTS);
              closeDialog("add-tenant");
            }}
          />
        </ResponsiveDialog>

        {#if tenants.length > 0}
          <List>
            {#each tenants as tenant}
              <ListItem
                title={tenant.shortName}
                description={`${tenant.shortName}.${window.location.hostname}`}
                descriptionOnClick={() =>
                  window.open(
                    `https://${tenant.shortName}.${window.location.hostname}`,
                    "_blank",
                    "noopener,noreferrer",
                  )}
                actions={[
                  {
                    type: "action",
                    icon: EditIcon,
                    label: m["edit"](),
                    onClick: () => {},
                  },
                  {
                    type: "action",
                    icon: SelectIcon,
                    label: m["select"](),
                    onClick: () => tenantsStore.setCurrentTenant(tenant.id, true),
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
                      curTenant = tenant;
                      openDialog("delete-tenant");
                    },
                  },
                ]}
              >
                {tenant.shortName}
              </ListItem>
            {/each}
          </List>
          <ResponsiveDialog
            id="delete-tenant"
            title={m["tenants.delete.title"]()}
            triggerHidden={true}
          >
            {#if curTenant}
              <DeleteTenantForm
                entity={curTenant}
                done={() => {
                  closeDialog("delete-tenant");
                  curTenant = null;
                  invalidate(ROUTES.DASHBOARD.TENANTS);
                }}
              />
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UnknownTenantIcon}
              headline="No tenants yet"
              description={m["tenants.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add-tenant")}>
              <PlusIcon />
              {m["tenants.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
