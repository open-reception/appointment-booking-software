<script lang="ts">
	import { HorizontalPagePadding, PageWithClaim } from "$lib/components/ui/page";
	import { Text } from "$lib/components/ui/typography";

	export let data;
</script>

<svelte:head>
	<title>Hello - OpenReception</title>
</svelte:head>

<PageWithClaim>
	<main>
		<HorizontalPagePadding class="flex flex-col items-start gap-4">
			<Text style="md">
				Environment configuration is
				{#await data.streamed.isEnvOk}
					unknown
				{:then isEnvOk}
					{isEnvOk ? "OK" : "NOT OK"}
				{/await}.
			</Text>
		</HorizontalPagePadding>
	</main>
</PageWithClaim>
