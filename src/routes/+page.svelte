<script lang="ts">
	import { HorizontalPagePadding, PageWithClaim } from "$lib/components/ui/page";
	import { Headline, Text } from "$lib/components/ui/typography";
	import { m } from "$i18n/messages.js";
	import { ComboBox } from "$lib/components/ui/combobox";
	import { getLocale, setLocale } from "$i18n/runtime.js";

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

			<ComboBox
				options={[
					{ value: "de", label: "Deutsch" },
					{ value: "en", label: "English" }
				]}
				value={getLocale()}
				onChange={(value) => {
					setLocale(value as "de" | "en");
				}}
				labels={{
					placeholder: m["i18n.label"](),
					search: m["i18n.search"](),
					notFound: m["i18n.notFound"]()
				}}
			/>
		</HorizontalPagePadding>
	</main>
</PageWithClaim>
