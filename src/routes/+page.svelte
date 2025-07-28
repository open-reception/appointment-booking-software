<script lang="ts">
	import { HorizontalPagePadding, PageWithClaim } from "$lib/components/ui/page";
	import { Headline, Text } from "$lib/components/ui/typography";
	import { toggleMode } from "mode-watcher";
	import { m } from "$i18n/messages.js";

	export let data;
</script>

<svelte:head>
	<title>Hello - OpenReception</title>
</svelte:head>

<PageWithClaim>
	<main>
		<HorizontalPagePadding class="flex flex-col items-start gap-4">
			<Headline level="h1" style="h1">{m.welcome()}</Headline>
			<Text style="md">
				Environment configuration is
				{#await data.streamed.isEnvOk}
					unknown
				{:then isEnvOk}
					{isEnvOk ? "OK" : "NOT OK"}
				{/await}.
			</Text>
			<button onclick={toggleMode}>Toggle Mode</button>
		</HorizontalPagePadding>
	</main>
</PageWithClaim>
