<script lang="ts">
	import * as Form from "$lib/components/ui/form";
	import { m } from "$i18n/messages.js";
	import { CenteredCard } from "$lib/components/layouts";
	import { PageWithClaim } from "$lib/components/ui/page";
	import ResendConfirmationForm from "./resend-confirmation-form.svelte";
	import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";

	export let data;

	const formId = "resend-confirmation-form";
	let isSubmitting = false;

	const onEvent: EventReporter = (params) => {
		if (params.isSubmitting) {
			isSubmitting = true;
		}
		if (params.isSubmitting === false) {
			isSubmitting = false;
		}
	};
</script>

<svelte:head>
	<title>{m["confirm.resend.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
	<CenteredCard.Root>
		<CenteredCard.Header>
			<CenteredCard.Title>
				{m["confirm.resend.title"]()}
			</CenteredCard.Title>
			<CenteredCard.Description>
				{m["confirm.resend.description"]()}
			</CenteredCard.Description>
		</CenteredCard.Header>
		<CenteredCard.Main>
			<ResendConfirmationForm {formId} {data} {onEvent} />
		</CenteredCard.Main>
		<CenteredCard.Action>
			<Form.Button
				size="lg"
				class="w-full"
				form={formId}
				isLoading={isSubmitting}
				disabled={isSubmitting}
			>
				{m["confirm.resend.action"]()}
			</Form.Button>
		</CenteredCard.Action>
	</CenteredCard.Root>
</PageWithClaim>
