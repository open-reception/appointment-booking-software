<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import Check from "@lucide/svelte/icons/check-circle";
	import Error from "@lucide/svelte/icons/ban";
	import Pointer from "@lucide/svelte/icons/pointer";
	import AtSign from "@lucide/svelte/icons/at-sign";
	import { m } from "$i18n/messages";

	export type PasskeyState = "initial" | "click" | "loading" | "user" | "success" | "error";
	let {
		ref = $bindable(null),
		state,
		class: className,
		onclick,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLHeadingElement>> & {
		state: PasskeyState;
		onclick?: () => void;
	} = $props();

	const disabledStates: PasskeyState[] = ["initial", "loading", "user", "success"];
	const onClick = () => {
		if (!disabledStates.includes(state)) {
			onclick?.();
		}
	};
</script>

<div
	bind:this={ref}
	class={cn(
		"dark:bg-input/30 border-input ring-offset-background flex h-9 w-full min-w-0 items-center gap-2 rounded-md border bg-transparent px-3 text-sm font-medium shadow-xs transition-[color,box-shadow] outline-none select-none md:text-sm",
		className
	)}
	class:opacity-50={disabledStates.includes(state)}
	class:cursor-not-allowed={disabledStates.includes(state)}
	class:cursor-pointer={!disabledStates.includes(state)}
	onclick={onClick}
	{...restProps}
>
	{#if state === "initial"}
		<AtSign class="size-4" />
		{m["passkey.add.initial"]()}
	{:else if state === "click"}
		<Pointer class="size-4" />
		{m["passkey.add.click"]()}
	{:else if state === "loading"}
		<Loader2Icon class="size-4 animate-spin" />
		{m["passkey.add.loading"]()}
	{:else if state === "user"}
		<Loader2Icon class="size-4 animate-spin" />
		{m["passkey.add.user"]()}
	{:else if state === "success"}
		<Check class="size-4" />
		{m["passkey.add.success"]()}
	{:else if state === "error"}
		<Error class="size-4" />
		{m["passkey.add.error"]()}
	{/if}
</div>
