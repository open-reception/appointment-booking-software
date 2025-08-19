<script lang="ts">
	import { m } from "$i18n/messages.js";
	import { CenteredCard } from "$lib/components/layouts";
	import { CenterLoadingState, CenterState } from "$lib/components/templates/empty-state";
	import { Button } from "$lib/components/ui/button";
	import { PageWithClaim } from "$lib/components/ui/page";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import Ban from "@lucide/svelte/icons/ban";
	import Check from "@lucide/svelte/icons/check";
	import type { PageData } from "./$types";

	export let data: PageData;
</script>

<svelte:head>
	<title>{m["setup.verify_email.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
	<CenteredCard.Root>
		<CenteredCard.Main>
			{#await data.streaming.confirmation}
				<CenterLoadingState />
			{:then confirmation}
				{#if confirmation.success}
					{#if confirmation.isSetup}
						<CenterState
							Icon={Check}
							headline={m["setup.confirm.success.title"]()}
							description={m["setup.confirm.success.description"]()}
						/>
					{:else}
						<CenterState
							Icon={Check}
							headline={m["confirm.success.title"]()}
							description={m["confirm.success.description"]()}
						/>
					{/if}
				{:else}
					<CenterState
						Icon={Ban}
						headline={m["confirm.error.title"]()}
						description={m["confirm.error.description"]()}
					/>
				{/if}
			{/await}
		</CenteredCard.Main>
		<CenteredCard.Action>
			{#await data.streaming.confirmation}
				<Skeleton class="mx-auto h-2 w-3/4" />
				<Skeleton class="mx-auto h-2 w-1/4" />
				<Skeleton class="h-10 w-full" />
			{:then confirmation}
				{#if confirmation.success}
					{#if confirmation.isSetup}
						<CenteredCard.ActionHint>
							{m["setup.confirm.success.hint"]()}
						</CenteredCard.ActionHint>
						<Button size="lg" class="w-full">
							{m["setup.confirm.success.action"]()}
						</Button>
					{:else}
						<Button size="lg" class="w-full">
							{m["confirm.success.action"]()}
						</Button>
					{/if}
				{:else}
					<Button size="lg" class="w-full">
						{m["confirm.error.action"]()}
					</Button>
				{/if}
			{/await}
		</CenteredCard.Action>
	</CenteredCard.Root>
</PageWithClaim>
