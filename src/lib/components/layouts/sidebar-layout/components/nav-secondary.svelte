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

	const items = [
		{
			title: m["nav.staff"](),
			url: ROUTES.DASHBOARD.STAFF,
			isTenatOnly: true,
			icon: StaffIcon
		},
		{
			title: m["nav.settings"](),
			url: ROUTES.DASHBOARD.SETTINGS,
			isTenatOnly: true,
			icon: SettingsIcon
		},
		{
			title: m["nav.documentation"](),
			url: "https://open-reception.org",
			isTenatOnly: false,
			icon: DocsIcon
		}
	];
</script>

<Sidebar.Group>
	{#each items as item (item.title)}
		{#if item.isTenatOnly === false || $auth.user?.tenantId}
			<Sidebar.MenuItem>
				<Sidebar.MenuButton isActive={isCurrentSection(item.url)} tooltipContent={item.title}>
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
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		{/if}
	{/each}
</Sidebar.Group>
