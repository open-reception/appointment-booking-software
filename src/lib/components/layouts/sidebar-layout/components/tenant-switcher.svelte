<script lang="ts">
	import { m } from "$i18n/messages";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { useSidebar } from "$lib/components/ui/sidebar";
	import { Text } from "$lib/components/ui/typography";
	import { auth } from "$lib/stores/auth";
	import type { TTenant } from "$lib/types/tenant";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import UnknownTenantIcon from "@lucide/svelte/icons/ticket-x";
	import PlusIcon from "@lucide/svelte/icons/plus";

	const sidebar = useSidebar();

	const tenants: TTenant[] = [
		// {
		// 	id: "praxis-1",
		// 	name: "Praxis 1",
		// 	logo: ChevronsUpDownIcon
		// },
		// {
		// 	id: "praxis-2",
		// 	name: "Praxis 2",
		// 	logo: ChevronsUpDownIcon
		// }
	];
	let activeTenantId = $auth.user?.tenantId;
	let activeTenant = $derived(tenants.find((t) => t.id === activeTenantId));
</script>

<Sidebar.Menu>
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
							<UnknownTenantIcon class="size-4" />
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<Text style="md" class="truncate font-medium">
								{activeTenant?.name ?? m["nav.noTenantSelected.title"]()}
							</Text>
							<Text style="xs" class="truncate">
								{activeTenant?.url ?? m["nav.noTenantSelected.description"]()}
							</Text>
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
				{#each tenants as tenant (tenant.id)}
					<DropdownMenu.Item onSelect={() => (activeTenantId = tenant.id)} class="gap-2 p-2">
						<div class="flex size-6 items-center justify-center rounded-md border">
							<UnknownTenantIcon class="size-3.5 shrink-0" />
						</div>
						{tenant.name}
					</DropdownMenu.Item>
				{/each}
				<DropdownMenu.Separator />
				<DropdownMenu.Item class="gap-2 p-2">
					<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
						<PlusIcon class="size-4" />
					</div>
					<div class="text-muted-foreground font-medium">{m["nav.addTenant"]()}</div>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
</Sidebar.Menu>
