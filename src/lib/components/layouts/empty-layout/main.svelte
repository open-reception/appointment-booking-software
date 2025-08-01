<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";

	let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class="flex grow flex-col items-center justify-center gap-5 text-center md:grow-0">
	{@render children?.()}
</div>
