<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { isCurrentSection } from "$lib/utils/routes";
  import DocsIcon from "@lucide/svelte/icons/book-open-text";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import SettingsIcon from "@lucide/svelte/icons/settings-2";
  import StaffIcon from "@lucide/svelte/icons/users";
  import { auth } from "$lib/stores/auth";
  import { m } from "$i18n/messages";
  import type { NavItem } from "..";

  const items: NavItem[] = [
    {
      title: m["nav.staff"](),
      url: ROUTES.DASHBOARD.STAFF,
      isTenantOnly: true,
      icon: StaffIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN"],
    },
    {
      title: m["nav.settings"](),
      url: ROUTES.DASHBOARD.SETTINGS,
      isTenantOnly: true,
      icon: SettingsIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN"],
    },
    {
      title: m["nav.documentation"](),
      url: "https://open-reception.org",
      isTenantOnly: false,
      icon: DocsIcon,
      roles: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
    },
  ];
</script>

<Sidebar.Group class="gap-0.5">
  {#each items as item (item.title)}
    {#if item.isTenantOnly === false || $auth.user?.tenantId}
      {#if $auth.user && item.roles.includes($auth.user?.role)}
        <Sidebar.MenuItem>
          <Sidebar.MenuButton isActive={isCurrentSection(item.url)} tooltipContent={item.title}>
            <!-- eslint-disable svelte/no-navigation-without-resolve -->
            {#snippet child({ props })}
              <a
                href={item.url}
                {...props}
                target={item.url.startsWith("http") ? "_blank" : undefined}
              >
                <item.icon />
                <Text style="xs">{item.title}</Text>
                {#if item.url.startsWith("http")}
                  <ExternalLinkIcon class="text-light ml-auto !size-3" />
                {/if}
              </a>
            {/snippet}
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/if}
    {/if}
  {/each}
</Sidebar.Group>
