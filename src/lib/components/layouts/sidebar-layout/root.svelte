<script lang="ts">
	import AppSidebar from "$lib/components/layouts/sidebar-layout/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb";
	import { HorizontalPagePadding, PageWithClaim } from "$lib/components/ui/page";
	import { Separator } from "$lib/components/ui/separator";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import type { HTMLAttributes } from "svelte/elements";
	import { sidebar } from "$lib/stores/sidebar";

	let {
		children,
		breakcrumbs
	}: HTMLAttributes<HTMLDivElement> & { breakcrumbs?: Array<{ label: string; href: string }> } =
		$props();
</script>

<Sidebar.Provider bind:open={$sidebar.isOpen} onOpenChange={(open) => sidebar.setOpen(open)}>
	<AppSidebar />
	<Sidebar.Inset>
		<PageWithClaim>
			<HorizontalPagePadding>
				<header
					class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
				>
					<div class="flex items-center gap-2">
						<Sidebar.Trigger class="-ml-1" />
						{#if breakcrumbs && breakcrumbs.length > 0}
							<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
							<Breadcrumb.Root>
								<Breadcrumb.List>
									{#each breakcrumbs as crumb, index (`${crumb.href}-${index}`)}
										{#if index === breakcrumbs.length - 1}
											<Breadcrumb.Item>
												<Breadcrumb.Page>
													{crumb.label}
												</Breadcrumb.Page>
											</Breadcrumb.Item>
										{:else}
											<Breadcrumb.Item class="hidden md:block">
												<Breadcrumb.Link href={crumb.href}>
													{crumb.label}
												</Breadcrumb.Link>
											</Breadcrumb.Item>
											<Breadcrumb.Separator class="hidden md:block" />
										{/if}
									{/each}
								</Breadcrumb.List>
							</Breadcrumb.Root>
						{/if}
					</div>
				</header>
				{@render children?.()}
			</HorizontalPagePadding>
		</PageWithClaim>
	</Sidebar.Inset>
</Sidebar.Provider>
