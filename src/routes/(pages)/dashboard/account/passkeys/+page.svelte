<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import EmptyState from "$lib/components/templates/empty-state/center-state.svelte";
  import { List, ListItem } from "$lib/components/templates/list";
  import { LoadingList } from "$lib/components/templates/loading";
  import { Button } from "$lib/components/ui/button";
  import { closeDialog, openDialog, ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { Headline } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import type { RedactedPasskeyHydrated } from "$lib/types/passkeys";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { getLocalTimeZone } from "@internationalized/date";
  import { UserKey, Pen, PlusIcon, Trash2, OctagonX } from "@lucide/svelte";
  import { EditPasskeyForm } from "./(components)/edit-passkey-form";
  import { AddPasskeyForm } from "./(components)/add-passkey-form";

  const { data } = $props();
  let curItem: RedactedPasskeyHydrated | null = $state(null);
</script>

<svelte:head>
  <title>{m["account.passkeys.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.account"](),
      href: ROUTES.DASHBOARD.ACCOUNT.MAIN,
    },
    {
      label: m["account.passkeys.navItem"](),
      href: ROUTES.DASHBOARD.ACCOUNT.PASSKEYS,
    },
  ]}
>
  <MaxPageWidth maxWidth="md" class="flex flex-col gap-6">
    <Headline level="h1" style="h3">{m["account.passkeys.title"]()}</Headline>
    {#await data.streamed.list}
      <LoadingList title={m["account.passkeys.list.loading"]()} />
    {:then items}
      <div class="flex flex-col items-start gap-5">
        <ResponsiveDialog
          id="add"
          title={m["account.passkeys.add.title"]()}
          description={m["account.passkeys.add.description"]()}
          triggerHidden={items.length === 0}
        >
          {#snippet triggerLabel()}
            <PlusIcon /> {m["account.passkeys.add.title"]()}
          {/snippet}
          {#if items.length >= 3}
            <EmptyState
              Icon={OctagonX}
              headline={m["account.passkeys.add.maxReached.title"]()}
              description={m["account.passkeys.add.maxReached.description"]()}
            />
          {:else}
            <AddPasskeyForm />
          {/if}
        </ResponsiveDialog>

        {#if items.length > 0}
          <List>
            {#each items as item (item.id)}
              <ListItem
                title={item.deviceName || m["account.passkeys.list.unnamedPasskey"]()}
                description={`${m["account.passkeys.list.createdAt"]({
                  createdAt: item.createdAt
                    ? toDisplayDateTime(item.createdAt, {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: getLocalTimeZone(),
                      })
                    : m["unknown"](),
                })} ${m["account.passkeys.list.lastUsedAt"]({
                  lastUsedAt: item.lastUsedAt
                    ? toDisplayDateTime(item.lastUsedAt, {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: getLocalTimeZone(),
                      })
                    : m["never"](),
                })}`}
                actions={[
                  {
                    type: "action",
                    icon: Pen,
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
                    icon: Trash2,
                    label: m["delete"](),
                    isDestructive: true,
                    isDisabled: data.passkeyId === item.id,
                    onClick: () => {
                      curItem = item;
                      openDialog("delete");
                    },
                  },
                ]}
                badges={data.passkeyId === item.id
                  ? [
                      {
                        label: m["account.passkeys.list.current"](),
                        variant: "outline",
                      },
                    ]
                  : undefined}
              />
            {/each}
          </List>
          <ResponsiveDialog
            id="edit"
            title={m["account.passkeys.edit.title"]()}
            description={m["account.passkeys.edit.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              <EditPasskeyForm
                entity={curItem}
                done={() => {
                  closeDialog("edit");
                  curItem = null;
                }}
              />
            {/if}
          </ResponsiveDialog>
          <ResponsiveDialog
            id="delete"
            title={m["account.passkeys.delete.title"]()}
            description={m["account.passkeys.delete.description"]()}
            triggerHidden={true}
          >
            {#if curItem}
              Delete
              <ul>
                <li>Cannot delete last passkey (check be for this as well)</li>
                <li>
                  Delete
                  <ul>
                    <li>Remove from db</li>
                    <li>Go through tunnels and remove this passkey from it</li>
                    <ul>
                      <li>
                        On creation of a new client tunnel, also sve user passkeyId in
                        client_tunnel_staff_key_share `// TODO: passkeyId`
                      </li>
                      <li>migration of already existing passkeys</li>
                      <li>Delete from client_tunnel_staff_key_share where userId and passkeyId</li>
                    </ul>
                  </ul>
                </li>
              </ul>
            {/if}
          </ResponsiveDialog>
        {:else}
          <div class="flex w-full flex-col items-center">
            <EmptyState
              Icon={UserKey}
              headline={m["account.passkeys.list.empty.title"]()}
              description={m["account.passkeys.list.empty.description"]()}
            />
            <Button size="lg" onclick={() => openDialog("add")}>
              <PlusIcon />
              {m["account.passkeys.add.title"]()}
            </Button>
          </div>
        {/if}
      </div>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
