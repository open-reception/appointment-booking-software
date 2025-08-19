<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { SubmitFunction } from "@sveltejs/kit";
	import type { Action } from "svelte/action";
	import type { HTMLAttributes } from "svelte/elements";

	export type EventReporter = (params: { isSubmitting?: boolean }) => void;
	type EnhanceFunction = Action<HTMLFormElement, any>;

	let {
		formId,
		enhance,
		class: className,
		children
	}: {
		formId: string;
		enhance: EnhanceFunction;
		class?: string;
	} & HTMLAttributes<HTMLFormElement> = $props();
</script>

<form id={formId} method="POST" use:enhance class={cn("flex flex-col gap-3", className)}>
	{@render children?.()}
</form>
