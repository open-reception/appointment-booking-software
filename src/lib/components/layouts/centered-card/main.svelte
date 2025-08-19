<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";

	let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class="flex grow flex-col gap-2">
	{@render children?.()}
</div>
