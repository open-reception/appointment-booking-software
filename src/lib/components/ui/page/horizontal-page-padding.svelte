<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		as = "div",
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { as?: "div" | "main" | "footer" } = $props();
</script>

<svelte:element this={as} bind:this={ref} class={cn("px-4", className)} {...restProps}>
	{@render children?.()}
</svelte:element>
