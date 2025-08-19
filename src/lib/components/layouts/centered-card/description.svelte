<script lang="ts">
	import { Text } from "$lib/components/ui/typography";
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let { class: className, children }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<Text style="md" color="medium" class={cn(className)}>
	{@render children?.()}
</Text>
