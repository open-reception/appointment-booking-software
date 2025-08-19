<script lang="ts">
	import { m } from "$i18n/messages.js";
	import { EmptyLayout } from "$lib/components/layouts";
	import { Button } from "$lib/components/ui/button";
	import { PageWithClaim } from "$lib/components/ui/page";
	import { Headline, Text } from "$lib/components/ui/typography";
	import { ROUTES } from "$lib/const/routes.js";
</script>

<svelte:head>
	<title>{m.welcome()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
	<EmptyLayout.Root>
		<EmptyLayout.Main>
			<img class="mb-5 size-50" alt={m.logo()} src="/favicon.svg" />
			<Headline level="h1" style="h1">{m.welcome()}</Headline>
			<Text style="lg" color="medium">{m.slogan()}</Text>
		</EmptyLayout.Main>
		<EmptyLayout.Action>
			<Button size="lg" class="w-full" href={ROUTES.SETUP.CREATE_ADMIN_ACCOUNT}>
				{m["setup.start"]()}
			</Button>
		</EmptyLayout.Action>
	</EmptyLayout.Root>
</PageWithClaim>
