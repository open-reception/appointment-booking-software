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

  const items = [
    {
      title: m["nav.home"](),
      url: ROUTES.DASHBOARD.MAIN,
      isTenatOnly: false,
      icon: HomeIcon,
    },
    {
      title: m["nav.tenants"](),
      url: ROUTES.DASHBOARD.TENANTS,
      isTenatOnly: false,
      icon: TenantsIcon,
    },
    {
      title: m["nav.calendar"](),
      url: ROUTES.DASHBOARD.CALENDAR,
      isTenatOnly: true,
      icon: CalendarIcon,
    },
    {
      title: m["nav.agents"](),
      url: ROUTES.DASHBOARD.AGENTS,
      isTenatOnly: true,
      icon: AgentsIcon,
    },
    {
      title: m["nav.channels"](),
      url: ROUTES.DASHBOARD.CHANNELS,
      isTenatOnly: true,
      icon: ChannelsIcon,
    },
    {
      title: m["nav.absences"](),
      url: ROUTES.DASHBOARD.ABSENCES,
      isTenatOnly: true,
      icon: AbsencesIcon,
    },
  ];
</script>

<Sidebar.Group class="gap-1">
  {#each items as item (item.title)}
    {#if item.isTenatOnly === false || $auth.user?.tenantId}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton isActive={isCurrentSection(item.url)} tooltipContent={item.title}>
          {#snippet child({ props })}
            <a href={item.url} {...props}>
              <item.icon />
              <Text style="md" class="ml-2">{item.title}</Text>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {/if}
  {/each}
</Sidebar.Group>
