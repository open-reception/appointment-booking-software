<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { Text } from "../typography";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import Check from "@lucide/svelte/icons/check-circle";
	import Error from "@lucide/svelte/icons/ban";
	import { m } from "$i18n/messages";

	export type PasskeyState = "initial" | "user" | "loading" | "success" | "error";
	let {
		ref = $bindable(null),
		state,
		class: className,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLHeadingElement>> & {
		state: PasskeyState;
	} = $props();
</script>

<div
	bind:this={ref}
	class={cn(
		"dark:bg-input/30 border-input ring-offset-background flex h-9 w-full min-w-0 items-center gap-2 rounded-md border bg-transparent px-3 text-sm font-medium shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
		className
	)}
	{...restProps}
>
	{#if state === "initial"}
		<Loader2Icon class="size-4 animate-spin" />
		{m["login.passkey.initial"]()}
	{:else if state === "user"}
		<Loader2Icon class="size-4 animate-spin" />
		{m["login.passkey.user"]()}
	{:else if state === "loading"}
		<Loader2Icon class="size-4 animate-spin" />
		{m["login.passkey.loading"]()}
	{:else if state === "success"}
		<Check class="size-4" />
		{m["login.passkey.success"]()}
	{:else if state === "error"}
		<Error class="size-4" />
		{m["login.passkey.error"]()}
	{/if}
</div>
