<script lang="ts">
	import { HorizontalPagePadding, PageWithClaim } from "$lib/components/ui/page";
	import { Headline, Text } from "$lib/components/ui/typography";
	import { toggleMode } from "mode-watcher";
	import { onMount } from "svelte";

	let envVarsOkay = {};

	onMount(async () => {
		const response = await fetch("/api/env");
		envVarsOkay = (await response.json()).envOkay ? "okay" : "not okay";
	});
</script>

<svelte:head>
	<title>Hello - OpenReception</title>
</svelte:head>

<PageWithClaim>
	<main>
		<HorizontalPagePadding>
			<Headline level="h1" style="h1">Welcome to OpenReception</Headline>
			<Text style="md">Environment configuration is {envVarsOkay}</Text>
			<button onclick={toggleMode}>Toggle Mode</button>
		</HorizontalPagePadding>
	</main>
</PageWithClaim>
