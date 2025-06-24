<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { tv, type VariantProps } from "tailwind-variants";

	const variants = tv({
		base: "scroll-m-20 tracking-tight",
		variants: {
			style: {
				h1: "text-4xl font-extrabold lg:text-5xl",
				h2: "border-b pb-2 text-3xl font-semibold transition-colors first:mt-0",
				h3: "text-2xl font-semibold",
				h4: "text-xl font-semibold"
			}
		}
	});

	let {
		ref = $bindable(null),
		level,
		style,
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLHeadingElement>> & {
		level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
		style: VariantProps<typeof variants>["style"];
	} = $props();
</script>

<svelte:element
	this={level}
	bind:this={ref}
	class={cn(variants({ style }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
