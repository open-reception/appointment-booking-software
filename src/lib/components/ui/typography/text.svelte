<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { tv, type VariantProps } from "tailwind-variants";

	const variants = tv({
		variants: {
			style: {
				lg: "text-xl",
				md: "leading-7 [&:not(:first-child)]:mt-6",
				sm: "text-sm font-medium leading-none",
				xs: "text-xs"
			}
		},
		defaultVariants: {
			style: "xs"
		}
	});

	let {
		ref = $bindable(null),
		style,
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> & {
		style: VariantProps<typeof variants>["style"];
	} = $props();
</script>

<span bind:this={ref} class={cn(variants({ style }), className)} {...restProps}>
	{@render children?.()}
</span>
