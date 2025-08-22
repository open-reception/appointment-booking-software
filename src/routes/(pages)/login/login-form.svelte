<script lang="ts">
	import { goto } from "$app/navigation";
	import { m } from "$i18n/messages.js";
	import { Button } from "$lib/components/ui/button";
	import * as Form from "$lib/components/ui/form";
	import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
	import { Input } from "$lib/components/ui/input";
	import { ROUTES } from "$lib/const/routes";
	import { toast } from "svelte-sonner";
	import { writable } from "svelte/store";
	import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { formSchema, type FormSchema } from "./schema";

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
				await goto(ROUTES.DASHBOARD.MAIN);
			} else {
				toast.error(m["login.error"]());
			}
			onEvent({ isSubmitting: false });
		},
		onSubmit: () => onEvent({ isSubmitting: true })
	});

	const { form: formData, enhance } = form;
	const isUsingPasskey = writable(false);
</script>

<Form.Root {formId} {enhance}>
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
