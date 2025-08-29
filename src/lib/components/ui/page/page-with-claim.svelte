<script lang="ts">
	import { dev } from "$app/environment";
	import { m } from "$i18n/messages";
	import { cn, type WithElementRef } from "$lib/utils";
	import { toggleMode, mode } from "mode-watcher";
	import type { HTMLAttributes } from "svelte/elements";
	import { Text } from "../typography";
	import HorizontalPagePadding from "./horizontal-page-padding.svelte";
	import { LanguageSwitch } from "$lib/components/templates/language-switch";

	let {
		ref = $bindable(null),
		class: className,
		children,
		isWithLanguageSwitch = false,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { isWithLanguageSwitch?: boolean } = $props();
</script>

<div bind:this={ref} class={cn("flex min-h-dvh flex-col", className)} {...restProps}>
	{#if isWithLanguageSwitch}
		<HorizontalPagePadding class="flex pt-4">
			<LanguageSwitch class="ml-auto" triggerSize="sm" />
		</HorizontalPagePadding>
	{/if}
	{@render children?.()}

	<HorizontalPagePadding
		as="footer"
		class="bg-muted text-muted-foreground mt-auto flex items-center justify-between py-2"
	>
		{#if dev}
			<Text style="xs" class="flex gap-1">
				Viewport:
				<div class="sm:hidden">xs</div>
				<div class="hidden sm:block md:hidden">sm</div>
				<div class="hidden md:block lg:hidden">md</div>
				<div class="hidden lg:block xl:hidden">lg</div>
				<div class="hidden xl:block 2xl:hidden">xl</div>
				<div class="hidden 2xl:block">2xl</div>
			</Text>
		{/if}
		<Text style="xs" class="mx-auto">
			{m.poweredBy()}
			<a href="https://open-reception.org" target="_blank" class="underline">OpenReception</a>
		</Text>
		{#if dev}
			<button onclick={toggleMode} class="cursor-pointer text-xs">
				{mode?.current === "dark" ? "dark" : "light"}Mode
			</button>
		{/if}
	</HorizontalPagePadding>
</div>
