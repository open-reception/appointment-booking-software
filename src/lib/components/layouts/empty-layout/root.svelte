<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import { HorizontalPagePadding } from "../../ui/page";

	let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<HorizontalPagePadding
	as="main"
	data-slot="card-action"
	class={cn("mx-auto flex max-w-sm grow flex-col items-start py-10", className)}
	{...restProps}
>
	<div class="flex grow flex-col items-center justify-between gap-10 md:justify-center">
		{@render children?.()}
	</div>
</HorizontalPagePadding>
