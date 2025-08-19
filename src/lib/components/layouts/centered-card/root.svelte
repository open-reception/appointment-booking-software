<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import { HorizontalPagePadding } from "../../ui/page";
	import { Card } from "$lib/components/ui/card";

	let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<HorizontalPagePadding
	as="main"
	class={cn(
		"mx-auto flex w-full max-w-(--max-w-md) grow flex-col items-start pt-3 pb-4 sm:max-w-(--max-w-sm) sm:justify-center",
		className
	)}
	{...restProps}
>
	<Card class="w-full grow sm:grow-0">
		{@render children?.()}
	</Card>
</HorizontalPagePadding>
