<script lang="ts">
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { cn } from "$lib/utils";
	import Loader from "@lucide/svelte/icons/loader-2";

	let { class: className = "" }: { class?: string } = $props();
</script>

<div class={cn("my-10 flex grow flex-col justify-center gap-2 text-center", className)}>
	<Loader class="mx-auto mb-3 size-20 animate-spin" strokeWidth={1} />
	<Skeleton class="mx-auto h-10 w-45" />
	<Skeleton class="mx-auto h-5 w-60" />
	<Skeleton class="mx-auto h-5 w-35" />
</div>
