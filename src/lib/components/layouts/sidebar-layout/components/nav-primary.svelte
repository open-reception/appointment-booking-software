<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { isCurrentSection } from "$lib/utils/routes";
  import TenantsIcon from "@lucide/svelte/icons/tickets";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import HomeIcon from "@lucide/svelte/icons/house";
  import ChannelsIcon from "@lucide/svelte/icons/split";
  import AbsencesIcon from "@lucide/svelte/icons/tree-palm";
  import AgentsIcon from "@lucide/svelte/icons/user-star";
  import { m } from "$i18n/messages";
  import type { NavItem } from "..";

  const items: NavItem[] = [
    {
      title: m["nav.home"](),
      url: ROUTES.DASHBOARD.MAIN,
      isTenantOnly: false,
      icon: HomeIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
    },
    {
      title: m["nav.tenants"](),
      url: ROUTES.DASHBOARD.TENANTS,
      isTenantOnly: false,
      icon: TenantsIcon,
      roles: ["GLOBAL_ADMIN"],
    },
    {
      title: m["nav.calendar"](),
      url: ROUTES.DASHBOARD.CALENDAR,
      isTenantOnly: true,
      icon: CalendarIcon,
      roles: ["TENANT_ADMIN", "STAFF"],
    },
    {
      title: m["nav.agents"](),
      url: ROUTES.DASHBOARD.AGENTS,
      isTenantOnly: true,
      icon: AgentsIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
    },
    {
      title: m["nav.channels"](),
      url: ROUTES.DASHBOARD.CHANNELS,
      isTenantOnly: true,
      icon: ChannelsIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
    },
    {
      title: m["nav.absences"](),
      url: ROUTES.DASHBOARD.ABSENCES,
      isTenantOnly: true,
      icon: AbsencesIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
    },
  ];
</script>

<Sidebar.Group class="gap-1">
  {#each items as item (item.title)}
    {#if item.isTenantOnly === false || $auth.user?.tenantId}
      {#if $auth.user && item.roles.includes($auth.user?.role)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton isActive={isCurrentSection(item.url)} tooltipContent={item.title}>
            {#snippet child({ props })}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={item.url} {...props}>
                <item.icon />
                <Text style="md" class="ml-2">{item.title}</Text>
              </a>
            {/snippet}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/if}
    {/if}
  {/each}
</Sidebar.Group>
