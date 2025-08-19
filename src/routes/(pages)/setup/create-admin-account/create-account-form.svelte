<script lang="ts">
	import { m } from "$i18n/messages.js";
	import * as Form from "$lib/components/ui/form";
	import { Input } from "$lib/components/ui/input";
	import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { formSchema, type FormSchema } from "./schema";
	import { Button } from "$lib/components/ui/button";
	import { writable } from "svelte/store";
	import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
	import { toast } from "svelte-sonner";
	import { goto } from "$app/navigation";
	import { ROUTES } from "$lib/const/routes";
	import { getLocale } from "$i18n/runtime.js";
	import { onMount } from "svelte";

	let {
		data,
		formId,
		onEvent
	}: { formId: string; onEvent: EventReporter; data: { form: SuperValidated<Infer<FormSchema>> } } =
		$props();

	const form = superForm(data.form, {
		validators: zodClient(formSchema),
		onResult: async (event) => {
			if (event.result.type === "success") {
				toast.success(m["setup.create_admin_account.success"]());
				await goto(ROUTES.SETUP.CHECK_EMAIL, {
					state: { email: event.result.data?.form.data.email }
				});
			}

			onEvent({ isSubmitting: false });
		},
		onSubmit: () => onEvent({ isSubmitting: true })
	});

	const { form: formData, enhance } = form;
	const isUsingPasskey = writable(false);

	onMount(() => {
		if (!$formData.language) {
			$formData.language = getLocale() ?? "en";
		}
	});
</script>

<Form.Root {formId} {enhance}>
	<Form.Field {form} name="language" class="hidden">
		<Form.Control>
			{#snippet children({ props })}
				<input {...props} bind:value={$formData.language} type="hidden" />
			{/snippet}
		</Form.Control>
	</Form.Field>
	<Form.Field {form} name="email">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>{m["form.email"]()}</Form.Label>
				<Input {...props} bind:value={$formData.email} type="email" />
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Field {form} name="passphrase">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>{m["form.passphrase"]()}</Form.Label>
				<Input
					{...props}
					bind:value={$formData.passphrase}
					type="password"
					minlength={30}
					maxlength={100}
				/>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
		<Form.Description>
			{m["form.passphraseRequirements"]()}
			{m["login.or"]()}
			{#if $isUsingPasskey}
				<Button
					variant="link"
					size="sm"
					onclick={() => isUsingPasskey.set(false)}
					class="text-inherit"
				>
					{m["login.usePassphrase"]()}
				</Button>
			{:else}
				<Button
					variant="link"
					size="sm"
					onclick={() => isUsingPasskey.set(true)}
					class="text-inherit"
				>
					{m["login.usePasskey"]()}
				</Button>
			{/if}.
		</Form.Description>
	</Form.Field>
</Form.Root>
