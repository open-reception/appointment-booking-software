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
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import type { TStaff } from "$lib/types/users.js";
  import AccessIcon from "@lucide/svelte/icons/key-round";
  import EditIcon from "@lucide/svelte/icons/pencil";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import DeleteIcon from "@lucide/svelte/icons/trash-2";
  import UnknownItemIcon from "@lucide/svelte/icons/user-star";
  import { onMount } from "svelte";
  import { AddStaffMemberForm } from "./(components)/add-staff-member-form";
  import { DeleteStaffMemberForm } from "./(components)/delete-staff-member-form";
  import { EditStaffMemberForm } from "./(components)/edit-staff-member-form";
  import { GrantAccessForm } from "./(components)/grant-access-form";
  import { roles } from "./(components)/utils";

  const { data } = $props();
  let curItem: TStaff | null = $state(null);
  const myUserId = $derived($auth.user?.id);

  onMount(() => {
    if (history.state["sveltekit:states"]?.action === "add") {
      openDialog("add");
      history.replaceState({}, "");
    }
  });
</script>

<svelte:head>
  <title>{m["staff.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.staff"](),
      href: ROUTES.DASHBOARD.STAFF,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    {#await data.streamed.list as TStaff[]}
      <LoadingList title={m["staff.loading"]()} />
    {:then items}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add"
          title={m["staff.add.title"]()}
          description={m["staff.add.description"]()}
          triggerHidden={items.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["staff.add.title"]()}
          {/snippet}
          <AddStaffMemberForm
            done={() => {
              tenants.reload();
              invalidate(ROUTES.DASHBOARD.STAFF);
              closeDialog("add");
            }}
          />
        </ResponsiveDialog>

        {#if items.length > 0}
          <List>
            {#each items as item (item.id)}
              {@const role = roles.find((r) => r.value === item.role)?.label || item.role}
              <ListItem
                title={item.name}
                description={`${item.email} • ${role}`}
                actions={item.id === myUserId
                  ? undefined
                  : [
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
                        icon: AccessIcon,
                        label: m["staff.access.action"](),
                        isHidden: item.confirmationState === "ACCESS_GRANTED",
                        onClick: () => {
                          curItem = item;
                          openDialog("access");
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
                badges={item.role !== "GLOBAL_ADMIN" && item.confirmationState !== "ACCESS_GRANTED"
                  ? [{ label: m["staff.list.needsAccess"](), variant: "outline" }]
                  : undefined}
              >
                {item.name}
              </ListItem>
            {/each}
          </List>
          <ResponsiveDialog
            id="edit"
            title={m["staff.edit.title"]()}
            description={m["staff.edit.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              <EditStaffMemberForm
                entity={curItem}
                done={() => {
                  closeDialog("edit");
                  curItem = null;
                  invalidate(ROUTES.DASHBOARD.STAFF);
                }}
              />
            {/if}
          </ResponsiveDialog>
          <ResponsiveDialog id="delete" title={m["staff.delete.title"]()} triggerHidden={true}>
            {#if curItem}
              <DeleteStaffMemberForm
                entity={curItem}
                done={() => {
                  closeDialog("delete");
                  curItem = null;
                  invalidate(ROUTES.DASHBOARD.STAFF);
                }}
              />
            {/if}
          </ResponsiveDialog>
          <ResponsiveDialog id="access" title={m["staff.access.title"]()} triggerHidden={true}>
            {#if curItem}
              <GrantAccessForm
                entity={curItem}
                done={() => {
                  closeDialog("access");
                  curItem = null;
                  invalidate(ROUTES.DASHBOARD.STAFF);
                }}
              />
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UnknownItemIcon}
              headline={m["staff.list.empty.title"]()}
              description={m["staff.list.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add")}>
              <PlusIcon />
              {m["staff.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
