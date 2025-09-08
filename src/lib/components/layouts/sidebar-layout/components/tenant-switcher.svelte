<script lang="ts">
  import { goto } from "$app/navigation";
  import { m } from "$i18n/messages";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import UnplugIcon from "@lucide/svelte/icons/unplug";
  import UnknownTenantIcon from "@lucide/svelte/icons/shield-question-mark";
  import Loader from "@lucide/svelte/icons/loader-2";
  import { cn } from "$lib/utils";

  const sidebar = useSidebar();

  const maxTenantsToShow = 5;
  let activeTenantId = $auth.user?.tenantId;
  let activeTenant = $derived($tenants.tenants.find((t) => t.id === activeTenantId));

  $effect(() => {
    activeTenantId = $auth.user?.tenantId;
  });
</script>

<Sidebar.Menu>
  {#if $tenants.isLoading}
    <div class="@container">
      <Sidebar.MenuItem
        class={cn(
          "bg-sidebar-accent flex h-8 items-center justify-center rounded-md @[50px]:h-12 @[50px]:justify-start @[50px]:px-4",
        )}
      >
        <div class="flex items-center">
          <Loader class="size-4 animate-spin" strokeWidth={1} />
        </div>
      </Sidebar.MenuItem>
    </div>
  {:else}
    <Sidebar.MenuItem>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Sidebar.MenuButton
              {...props}
              size="lg"
              class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
              >
                {#if activeTenant}
                  <UnknownTenantIcon class="size-4" />
                {:else}
                  <UnplugIcon class="size-4" />
                {/if}
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                {#if activeTenant}
                  <Text style="md" class="truncate font-medium">
                    {activeTenant.shortName}
                  </Text>
                  <Text style="xs" class="truncate">
                    {activeTenant.shortName}.{window.location.hostname}
                  </Text>
                {:else}
                  <Text style="md" class="truncate font-medium">
                    {m["nav.noTenantSelected.title"]()}
                  </Text>
                  <Text style="xs" class="truncate">
                    {m["nav.noTenantSelected.description"]()}
                  </Text>
                {/if}
              </div>
              <ChevronsUpDownIcon class="ml-auto" />
            </Sidebar.MenuButton>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
          align="start"
          side={sidebar.isMobile ? "bottom" : "right"}
          sideOffset={4}
        >
          <DropdownMenu.Label class="text-muted-foreground text-xs"
            >{m["nav.tenants"]()}</DropdownMenu.Label
          >
          {#each $tenants?.tenants.slice(0, maxTenantsToShow) as tenant (tenant.id)}
            <DropdownMenu.Item
              onSelect={() => tenants.setCurrentTenant(tenant.id)}
              class="gap-2 p-2"
            >
              <div class="flex size-6 items-center justify-center rounded-md border">
                <UnknownTenantIcon class="size-3.5 shrink-0" />
              </div>
              {tenant.shortName}
            </DropdownMenu.Item>
          {/each}
          {#if $tenants?.tenants.length > maxTenantsToShow}
            <DropdownMenu.Separator />
            <DropdownMenu.Item class="gap-2 p-2" onclick={() => goto(ROUTES.DASHBOARD.TENANTS)}>
              <div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <EllipsisIcon class="size-4" />
              </div>
              <div class="text-muted-foreground font-medium">{m["tenants.allTenants"]()}</div>
            </DropdownMenu.Item>
          {/if}
          {#if activeTenant}
            <DropdownMenu.Separator />
            <DropdownMenu.Item class="gap-2 p-2" onclick={() => tenants.setCurrentTenant(null)}>
              <div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <UnplugIcon class="size-4" />
              </div>
              <div class="text-muted-foreground font-medium">{m["tenants.unselectTenant"]()}</div>
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Sidebar.MenuItem>
  {/if}
</Sidebar.Menu>
