<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import HorizontalPagePadding from "./horizontal-page-padding.svelte";
	import { Text } from "../typography";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	class={cn("flex min-h-dvh flex-col justify-between", className)}
	{...restProps}
>
	{@render children?.()}
	<footer>
		<HorizontalPagePadding class="bg-muted text-muted-foreground py-2 text-center">
			<Text style="xs">
				Powered by
				<a href="https://open-reception.org" target="_blank" class="underline">OpenReception</a>
			</Text>
		</HorizontalPagePadding>
	</footer>
</div>
